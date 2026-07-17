-- GY-NEXUS v3.0 초기 데이터베이스
-- Supabase Dashboard > SQL Editor에서 전체 실행하세요.

create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  affiliate_url text not null,
  platform text default 'etc',
  price_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists product_clicks_product_id_idx on public.product_clicks(product_id);
create index if not exists products_created_at_idx on public.products(created_at desc);

alter table public.products enable row level security;
alter table public.product_clicks enable row level security;

drop policy if exists "public can read products" on public.products;
create policy "public can read products" on public.products for select using (true);

drop policy if exists "public can insert products" on public.products;
create policy "public can insert products" on public.products for insert with check (true);

drop policy if exists "public can update products" on public.products;
create policy "public can update products" on public.products for update using (true) with check (true);

drop policy if exists "public can delete products" on public.products;
create policy "public can delete products" on public.products for delete using (true);

drop policy if exists "public can read clicks" on public.product_clicks;
create policy "public can read clicks" on public.product_clicks for select using (true);

drop policy if exists "public can insert clicks" on public.product_clicks;
create policy "public can insert clicks" on public.product_clicks for insert with check (true);

-- 주의: v2.0은 개인 관리자용 첫 실행 버전이라 공개 정책을 사용합니다.
-- 실제 다중 사용자 서비스 전환 시 로그인과 관리자 권한 정책으로 교체해야 합니다.

-- AI 생성 결과 저장
create table if not exists public.ai_contents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  content_type text not null check (content_type in ('blog','shorts','package')),
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_contents_created_at_idx on public.ai_contents(created_at desc);
alter table public.ai_contents enable row level security;
drop policy if exists "public can read ai contents" on public.ai_contents;
create policy "public can read ai contents" on public.ai_contents for select using (true);
drop policy if exists "public can insert ai contents" on public.ai_contents;
create policy "public can insert ai contents" on public.ai_contents for insert with check (true);
drop policy if exists "public can delete ai contents" on public.ai_contents;
create policy "public can delete ai contents" on public.ai_contents for delete using (true);

-- 예약 콘텐츠
create table if not exists public.content_schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null default 'naver_blog',
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists content_schedules_scheduled_at_idx on public.content_schedules(scheduled_at);
alter table public.content_schedules enable row level security;
drop policy if exists "authenticated can manage schedules" on public.content_schedules;
create policy "authenticated can manage schedules" on public.content_schedules for all to authenticated using (true) with check (true);

-- 로그인 적용 후 관리자 데이터 보호 권장 정책
-- Supabase Authentication > Users에서 관리자 이메일 계정을 생성하세요.


-- ===== GY-NEXUS 최종 운영형 확장 =====
create table if not exists public.trend_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  description text,
  image_url text,
  affiliate_url text not null,
  platform text default 'etc',
  price_text text,
  source_name text not null default 'manual',
  external_rank integer,
  external_score numeric default 0,
  trend_score numeric default 0,
  raw_data jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  collected_at timestamptz not null default now(),
  unique(source_name, affiliate_url)
);
create index if not exists trend_products_score_idx on public.trend_products(trend_score desc);
alter table public.trend_products enable row level security;
drop policy if exists "authenticated can manage trend products" on public.trend_products;
create policy "authenticated can manage trend products" on public.trend_products for all to authenticated using (true) with check (true);

create table if not exists public.revenue_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  platform text not null,
  order_id text not null,
  amount numeric not null default 0,
  commission numeric not null default 0,
  status text not null default 'confirmed',
  occurred_at timestamptz not null default now(),
  raw_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(platform, order_id)
);
create index if not exists revenue_events_occurred_at_idx on public.revenue_events(occurred_at desc);
alter table public.revenue_events enable row level security;
drop policy if exists "authenticated can manage revenue events" on public.revenue_events;
create policy "authenticated can manage revenue events" on public.revenue_events for all to authenticated using (true) with check (true);

create table if not exists public.publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  ai_content_id uuid references public.ai_contents(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  channel text not null default 'manual',
  title text not null,
  content text not null,
  status text not null default 'queued' check (status in ('queued','processing','published','retry','cancelled')),
  scheduled_at timestamptz not null default now(),
  published_at timestamptz,
  attempts integer not null default 0,
  external_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists publishing_jobs_status_idx on public.publishing_jobs(status, scheduled_at);
alter table public.publishing_jobs enable row level security;
drop policy if exists "authenticated can manage publishing jobs" on public.publishing_jobs;
create policy "authenticated can manage publishing jobs" on public.publishing_jobs for all to authenticated using (true) with check (true);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'one_click',
  status text not null check (status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  details jsonb default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);
alter table public.automation_runs enable row level security;
drop policy if exists "authenticated can manage automation runs" on public.automation_runs;
create policy "authenticated can manage automation runs" on public.automation_runs for all to authenticated using (true) with check (true);


-- ===== v3.1 AI 상품 후보 운영 엔진 =====
alter table public.trend_products add column if not exists status text not null default 'candidate';
alter table public.trend_products add column if not exists ai_score integer not null default 0;
alter table public.trend_products add column if not exists ai_summary text;
alter table public.trend_products add column if not exists target_audience text;
alter table public.trend_products add column if not exists selling_points jsonb not null default '[]'::jsonb;
alter table public.trend_products add column if not exists seo_keywords jsonb not null default '[]'::jsonb;
alter table public.trend_products add column if not exists shorts_hook text;
alter table public.trend_products add column if not exists caution text;
alter table public.trend_products add column if not exists analyzed_at timestamptz;
alter table public.trend_products drop constraint if exists trend_products_status_check;
alter table public.trend_products add constraint trend_products_status_check check (status in ('candidate','analyzed','approved','rejected'));
create index if not exists trend_products_status_score_idx on public.trend_products(status, ai_score desc, trend_score desc);

-- ===== GY-NEXUS v6.0 ULTIMATE 운영 안정화 =====
alter table public.automation_runs add column if not exists selected_product_id uuid;
alter table public.automation_runs add column if not exists channel text;
alter table public.automation_runs add column if not exists step_status jsonb not null default '{}'::jsonb;
alter table public.publishing_jobs add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.publishing_jobs add column if not exists max_attempts integer not null default 3;
create index if not exists automation_runs_created_at_idx on public.automation_runs(created_at desc);

-- ===== 운영형 기반: AI 비서와 연결 상태 =====
create table if not exists public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  command text not null,
  plan jsonb not null default '{}'::jsonb,
  status text not null default 'planned' check (status in ('planned','approved','running','completed','failed','cancelled')),
  approval_required boolean not null default true,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.assistant_runs enable row level security;
drop policy if exists "authenticated can manage assistant runs" on public.assistant_runs;
create policy "authenticated can manage assistant runs" on public.assistant_runs for all to authenticated using (true) with check (true);

create table if not exists public.connection_profiles (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  account_label text,
  external_account_id text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_account_id)
);
alter table public.connection_profiles enable row level security;
drop policy if exists "authenticated can manage connection profiles" on public.connection_profiles;
create policy "authenticated can manage connection profiles" on public.connection_profiles for all to authenticated using (true) with check (true);

-- ===== GY-NEXUS Ultimate v7.0 · Dream Y AI Company OS =====
create table if not exists public.company_memories (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  key text not null,
  value text not null,
  priority integer not null default 50,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category, key)
);
alter table public.company_memories enable row level security;
drop policy if exists "authenticated can manage company memories" on public.company_memories;
create policy "authenticated can manage company memories" on public.company_memories for all to authenticated using (true) with check (true);

create table if not exists public.strategy_meetings (
  id uuid primary key default gen_random_uuid(),
  command text not null,
  objective text,
  decision text,
  confidence integer not null default 0,
  agent_opinions jsonb not null default '[]'::jsonb,
  missions jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  success_metrics jsonb not null default '[]'::jsonb,
  status text not null default 'planned' check (status in ('planned','approved','running','completed','failed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_meetings enable row level security;
drop policy if exists "authenticated can manage strategy meetings" on public.strategy_meetings;
create policy "authenticated can manage strategy meetings" on public.strategy_meetings for all to authenticated using (true) with check (true);

create table if not exists public.evolution_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  signal text not null default 'manual',
  cause text,
  lesson text not null,
  next_action text,
  related_content_id uuid references public.ai_contents(id) on delete set null,
  related_product_id uuid references public.products(id) on delete set null,
  status text not null default 'open' check (status in ('open','applied','verified','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.evolution_entries enable row level security;
drop policy if exists "authenticated can manage evolution entries" on public.evolution_entries;
create policy "authenticated can manage evolution entries" on public.evolution_entries for all to authenticated using (true) with check (true);

insert into public.company_memories(category,key,value,priority)
values
('brand','company_name','GY-NEXUS Ultimate',100),
('brand','slogan','One Human. One AI Company.',100),
('policy','time_is_gold','대표의 시간을 가장 중요한 자산으로 생각한다.',100),
('audience','primary','20~40대',90),
('content','subtitle_policy','정확한 한국어 수동 자막 또는 AI 검수 SRT를 우선한다.',90)
on conflict(category,key) do nothing;

-- ===== GY-NEXUS Ultimate v7.0 · Sprint 2 Product Intelligence =====
alter table public.trend_products add column if not exists opportunity_grade text;
alter table public.trend_products add column if not exists opportunity_recommendation text;
create index if not exists trend_products_platform_score_idx on public.trend_products(platform, ai_score desc);

-- ===== Sprint 3: Content Factory =====
create table if not exists public.content_factory_runs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('processing','completed','failed')),
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists content_factory_runs_created_at_idx on public.content_factory_runs(created_at desc);
alter table public.content_factory_runs enable row level security;
drop policy if exists "authenticated can manage content factory runs" on public.content_factory_runs;
create policy "authenticated can manage content factory runs" on public.content_factory_runs for all to authenticated using (true) with check (true);
drop policy if exists "public can insert content factory runs" on public.content_factory_runs;
create policy "public can insert content factory runs" on public.content_factory_runs for insert with check (true);
drop policy if exists "public can read content factory runs" on public.content_factory_runs;
create policy "public can read content factory runs" on public.content_factory_runs for select using (true);

-- ===== Sprint 4: Creative Studio =====
create table if not exists public.creative_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('image','video')),
  title text not null,
  prompt text not null,
  provider text not null,
  provider_task_id text,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb not null default '{}'::jsonb,
  asset_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists creative_jobs_created_at_idx on public.creative_jobs(created_at desc);
alter table public.creative_jobs enable row level security;
drop policy if exists "authenticated can manage creative jobs" on public.creative_jobs;
create policy "authenticated can manage creative jobs" on public.creative_jobs for all to authenticated using (true) with check (true);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creative-assets','creative-assets',true,104857600,array['image/png','image/jpeg','image/webp','video/mp4'])
on conflict (id) do update set public=true, file_size_limit=104857600;
drop policy if exists "public can view creative assets" on storage.objects;
create policy "public can view creative assets" on storage.objects for select using (bucket_id='creative-assets');

-- ===== Sprint 6: Automation Engine · Job Queue · Execution Logs =====
create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','processing','retry','completed','failed','cancelled')),
  current_step text not null default 'queued',
  config jsonb not null default '{}'::jsonb,
  result_data jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists automation_jobs_queue_idx on public.automation_jobs(status, scheduled_at);
create index if not exists automation_jobs_created_idx on public.automation_jobs(created_at desc);
alter table public.automation_jobs enable row level security;
drop policy if exists "authenticated can manage automation jobs" on public.automation_jobs;
create policy "authenticated can manage automation jobs" on public.automation_jobs for all to authenticated using (true) with check (true);
drop policy if exists "public can manage automation jobs" on public.automation_jobs;
create policy "public can manage automation jobs" on public.automation_jobs for all to anon using (true) with check (true);

create table if not exists public.automation_job_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.automation_jobs(id) on delete cascade,
  run_id uuid references public.automation_runs(id) on delete set null,
  step text not null,
  status text not null check (status in ('running','completed','failed','skipped')),
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists automation_job_logs_job_idx on public.automation_job_logs(job_id, created_at desc);
create index if not exists automation_job_logs_created_idx on public.automation_job_logs(created_at desc);
alter table public.automation_job_logs enable row level security;
drop policy if exists "authenticated can manage automation job logs" on public.automation_job_logs;
create policy "authenticated can manage automation job logs" on public.automation_job_logs for all to authenticated using (true) with check (true);
drop policy if exists "public can manage automation job logs" on public.automation_job_logs;
create policy "public can manage automation job logs" on public.automation_job_logs for all to anon using (true) with check (true);

-- ===== Sprint 7: Product Intelligence Engine =====
create table if not exists public.product_intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  source_name text,
  item_count integer not null default 0,
  status text not null default 'completed' check (status in ('processing','completed','failed')),
  details jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists product_intelligence_runs_created_idx on public.product_intelligence_runs(created_at desc);
alter table public.product_intelligence_runs enable row level security;
drop policy if exists "public can manage product intelligence runs" on public.product_intelligence_runs;
create policy "public can manage product intelligence runs" on public.product_intelligence_runs for all using (true) with check (true);

create table if not exists public.trend_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  category text,
  source_name text not null default 'manual',
  demand_score integer not null default 50,
  competition_score integer not null default 50,
  opportunity_score integer not null default 50,
  metadata jsonb not null default '{}'::jsonb,
  collected_at timestamptz not null default now(),
  unique(source_name, keyword)
);
alter table public.trend_keywords enable row level security;
drop policy if exists "public can manage trend keywords" on public.trend_keywords;
create policy "public can manage trend keywords" on public.trend_keywords for all using (true) with check (true);

create table if not exists public.product_scores (
  id uuid primary key default gen_random_uuid(),
  trend_product_id uuid references public.trend_products(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  total_score integer not null default 0,
  score_data jsonb not null default '{}'::jsonb,
  recommendation text,
  created_at timestamptz not null default now()
);
create index if not exists product_scores_total_idx on public.product_scores(total_score desc);
alter table public.product_scores enable row level security;
drop policy if exists "public can manage product scores" on public.product_scores;
create policy "public can manage product scores" on public.product_scores for all using (true) with check (true);

create table if not exists public.competitor_analysis (
  id uuid primary key default gen_random_uuid(),
  trend_product_id uuid references public.trend_products(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  competitor_name text,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  price_position text,
  content_gap jsonb not null default '[]'::jsonb,
  source_url text,
  created_at timestamptz not null default now()
);
alter table public.competitor_analysis enable row level security;
drop policy if exists "public can manage competitor analysis" on public.competitor_analysis;
create policy "public can manage competitor analysis" on public.competitor_analysis for all using (true) with check (true);

-- ===== Sprint 5 · Publish Center =====
alter table public.publishing_jobs add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.publishing_jobs add column if not exists max_attempts integer not null default 3;
create index if not exists publishing_jobs_channel_idx on public.publishing_jobs(channel, created_at desc);
