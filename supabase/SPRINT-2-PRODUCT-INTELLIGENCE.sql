-- GY-NEXUS AI Company OS v2.0 · Sprint 2 Product Intelligence
-- Supabase Dashboard > SQL Editor에서 전체 실행하세요.

create extension if not exists "pgcrypto";

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

alter table public.trend_products add column if not exists status text not null default 'analyzed';
alter table public.trend_products add column if not exists ai_score integer not null default 0;
alter table public.trend_products add column if not exists opportunity_grade text;
alter table public.trend_products add column if not exists opportunity_recommendation text;
alter table public.trend_products add column if not exists ai_summary text;
alter table public.trend_products add column if not exists target_audience text;
alter table public.trend_products add column if not exists selling_points jsonb not null default '[]'::jsonb;
alter table public.trend_products add column if not exists seo_keywords jsonb not null default '[]'::jsonb;
alter table public.trend_products add column if not exists shorts_hook text;
alter table public.trend_products add column if not exists caution text;
alter table public.trend_products add column if not exists analyzed_at timestamptz;
alter table public.trend_products add column if not exists decision_at timestamptz;

create index if not exists trend_products_ai_score_idx on public.trend_products(ai_score desc);
create index if not exists trend_products_status_idx on public.trend_products(status, ai_score desc);
create index if not exists product_intelligence_runs_created_idx on public.product_intelligence_runs(created_at desc);

alter table public.product_intelligence_runs enable row level security;
drop policy if exists "authenticated can manage product intelligence runs" on public.product_intelligence_runs;
create policy "authenticated can manage product intelligence runs" on public.product_intelligence_runs for all to authenticated using (true) with check (true);

-- 기존 개인 관리자 개발 환경과 호환. 다중 사용자 운영 전 관리자 역할 기반 RLS로 강화하세요.
drop policy if exists "public can manage product intelligence runs" on public.product_intelligence_runs;
create policy "public can manage product intelligence runs" on public.product_intelligence_runs for all using (true) with check (true);
