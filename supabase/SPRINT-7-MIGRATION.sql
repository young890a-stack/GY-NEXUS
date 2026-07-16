-- GY-NEXUS Sprint 7 Product Intelligence Engine
create table if not exists public.product_intelligence_runs (
  id uuid primary key default gen_random_uuid(), run_type text not null, source_name text,
  item_count integer not null default 0, status text not null default 'completed' check (status in ('processing','completed','failed')),
  details jsonb not null default '{}'::jsonb, error_message text, created_at timestamptz not null default now()
);
create index if not exists product_intelligence_runs_created_idx on public.product_intelligence_runs(created_at desc);
alter table public.product_intelligence_runs enable row level security;
drop policy if exists "public can manage product intelligence runs" on public.product_intelligence_runs;
create policy "public can manage product intelligence runs" on public.product_intelligence_runs for all using (true) with check (true);
create table if not exists public.trend_keywords (
  id uuid primary key default gen_random_uuid(), keyword text not null, category text, source_name text not null default 'manual',
  demand_score integer not null default 50, competition_score integer not null default 50, opportunity_score integer not null default 50,
  metadata jsonb not null default '{}'::jsonb, collected_at timestamptz not null default now(), unique(source_name, keyword)
);
alter table public.trend_keywords enable row level security;
drop policy if exists "public can manage trend keywords" on public.trend_keywords;
create policy "public can manage trend keywords" on public.trend_keywords for all using (true) with check (true);
create table if not exists public.product_scores (
  id uuid primary key default gen_random_uuid(), trend_product_id uuid references public.trend_products(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade, total_score integer not null default 0,
  score_data jsonb not null default '{}'::jsonb, recommendation text, created_at timestamptz not null default now()
);
create index if not exists product_scores_total_idx on public.product_scores(total_score desc);
alter table public.product_scores enable row level security;
drop policy if exists "public can manage product scores" on public.product_scores;
create policy "public can manage product scores" on public.product_scores for all using (true) with check (true);
create table if not exists public.competitor_analysis (
  id uuid primary key default gen_random_uuid(), trend_product_id uuid references public.trend_products(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade, competitor_name text, strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb, price_position text, content_gap jsonb not null default '[]'::jsonb,
  source_url text, created_at timestamptz not null default now()
);
alter table public.competitor_analysis enable row level security;
drop policy if exists "public can manage competitor analysis" on public.competitor_analysis;
create policy "public can manage competitor analysis" on public.competitor_analysis for all using (true) with check (true);
