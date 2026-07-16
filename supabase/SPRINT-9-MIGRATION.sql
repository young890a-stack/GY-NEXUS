-- GY-NEXUS Sprint 9 · Growth Intelligence
create extension if not exists pgcrypto;

create table if not exists public.growth_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_url text,
  period_start date,
  period_end date,
  search_console_json jsonb not null default '{}'::jsonb,
  ga4_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists growth_snapshots_created_at_idx on public.growth_snapshots(created_at desc);

create table if not exists public.ai_growth_reports (
  id uuid primary key default gen_random_uuid(),
  site_url text,
  report_text text not null,
  source_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_growth_reports_created_at_idx on public.ai_growth_reports(created_at desc);

alter table public.growth_snapshots enable row level security;
alter table public.ai_growth_reports enable row level security;
