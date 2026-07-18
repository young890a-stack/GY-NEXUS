-- =========================================================
-- GY-NEXUS · PRODUCTION 2.0 FOUNDATION
-- 1) 회원 요금제·사용량 기반
-- 2) AI 전략회의 교차검증 기록
-- 3) 운영 데이터 RLS 잠금
-- Supabase Dashboard > SQL Editor에서 전체를 한 번 실행하세요.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- Membership ----------
create table if not exists public.subscription_plans (
  key text primary key check (key in ('free', 'plus', 'pro')),
  name text not null,
  monthly_price integer not null default 0 check (monthly_price >= 0),
  monthly_ai_requests integer not null check (monthly_ai_requests >= 0),
  features jsonb not null default '[]'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans(key, name, monthly_price, monthly_ai_requests, features)
values
  ('free', 'GY Free', 0, 3, '["맞춤 콘텐츠·상품", "북마크·알림", "AI 제목 월 3회"]'::jsonb),
  ('plus', 'GY Plus', 9900, 60, '["Free 전체", "AI 제작 월 60회", "키워드 알림", "결과 저장"]'::jsonb),
  ('pro', 'GY Pro', 29000, 300, '["Plus 전체", "AI 제작 월 300회", "SEO 패키지", "내보내기"]'::jsonb)
on conflict(key) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  monthly_ai_requests = excluded.monthly_ai_requests,
  features = excluded.features,
  updated_at = now();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_key text not null default 'free' references public.subscription_plans(key),
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'paused', 'cancelled')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz not null default date_trunc('month', now()),
  current_period_end timestamptz not null default date_trunc('month', now()) + interval '1 month',
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  units integer not null default 1 check (units > 0),
  status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id, status);
create index if not exists usage_events_user_period_idx on public.usage_events(user_id, feature, created_at desc);

insert into public.subscriptions(user_id, plan_key, status)
select id, 'free', 'active' from auth.users
on conflict(user_id) do nothing;

create or replace function public.provision_free_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions(user_id, plan_key, status)
  values(new.id, 'free', 'active')
  on conflict(user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_subscription_created on auth.users;
create trigger on_auth_user_subscription_created
after insert on auth.users
for each row execute function public.provision_free_subscription();

-- 동시에 여러 요청을 보내도 월 한도를 넘기지 않는 원자적 예약 함수입니다.
create or replace function public.reserve_member_usage(
  p_user_id uuid,
  p_feature text,
  p_units integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
  v_event_id uuid;
begin
  if p_units < 1 then
    raise exception 'usage units must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_feature || ':' || date_trunc('month', now())::text, 0));

  select coalesce(plan.monthly_ai_requests, 3)
  into v_limit
  from public.subscriptions subscription
  join public.subscription_plans plan on plan.key = subscription.plan_key
  where subscription.user_id = p_user_id
    and subscription.status in ('active', 'trialing')
  limit 1;

  v_limit := coalesce(v_limit, 3);

  select coalesce(sum(units), 0)
  into v_used
  from public.usage_events
  where user_id = p_user_id
    and feature = p_feature
    and status in ('reserved', 'succeeded')
    and created_at >= date_trunc('month', now());

  if v_used + p_units > v_limit then
    return null;
  end if;

  insert into public.usage_events(user_id, feature, units, status)
  values(p_user_id, p_feature, p_units, 'reserved')
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.reserve_member_usage(uuid, text, integer) from public;
revoke all on function public.reserve_member_usage(uuid, text, integer) from anon;
revoke all on function public.reserve_member_usage(uuid, text, integer) from authenticated;
grant execute on function public.reserve_member_usage(uuid, text, integer) to service_role;

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "plans_public_read" on public.subscription_plans;
create policy "plans_public_read" on public.subscription_plans
for select using (is_public = true);

drop policy if exists "subscriptions_own_read" on public.subscriptions;
create policy "subscriptions_own_read" on public.subscriptions
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "usage_own_read" on public.usage_events;
create policy "usage_own_read" on public.usage_events
for select to authenticated using (auth.uid() = user_id);

-- ---------- AI council audit ----------
alter table if exists public.strategy_meetings
  add column if not exists verification jsonb not null default '{}'::jsonb;

-- ---------- Owner data security ----------
-- 과거 스프린트에서 만든 광범위한 public/authenticated 쓰기 정책을 제거합니다.
-- 운영 API는 SUPABASE_SERVICE_ROLE_KEY를 사용하며 middleware에서 대표 이메일을 확인합니다.
do $$
declare
  table_name text;
  policy_row record;
  owner_tables text[] := array[
    'products', 'product_clicks', 'ai_contents', 'content_schedules', 'trend_products',
    'revenue_events', 'publishing_jobs', 'automation_runs', 'assistant_runs',
    'connection_profiles', 'company_memories', 'strategy_meetings', 'evolution_entries',
    'content_factory_runs', 'creative_jobs', 'automation_jobs', 'automation_job_logs',
    'product_intelligence_runs', 'trend_keywords', 'product_scores', 'competitor_analysis',
    'learning_rules', 'ai_recommendations', 'forecast_snapshots', 'seo_reports',
    'search_console_snapshots', 'growth_snapshots', 'ai_growth_reports',
    'company_daily_briefs', 'system_incidents', 'affiliate_imports',
    'product_dna_campaigns', 'video_projects', 'video_scenes', 'video_render_jobs',
    'publishing_strategies', 'quality_reviews', 'brand_settings', 'system_audit_logs',
    'system_backups', 'integration_health', 'gy_pipeline_runs'
  ];
begin
  foreach table_name in array owner_tables loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      for policy_row in
        select policyname from pg_policies where schemaname = 'public' and tablename = table_name
      loop
        execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
      end loop;
    end if;
  end loop;
end $$;

-- 고객에게 공개해야 하는 최소 읽기 권한만 다시 엽니다.
create policy "products_public_read" on public.products for select using (true);
create policy "product_clicks_public_read" on public.product_clicks for select using (true);

comment on table public.subscription_plans is 'GY 멤버십 상품 정의. 결제 출시 전에는 코드와 함께 관리';
comment on table public.subscriptions is '회원별 현재 요금제와 결제 기간';
comment on table public.usage_events is 'AI 기능 사용량 예약·성공·실패 감사 기록';
