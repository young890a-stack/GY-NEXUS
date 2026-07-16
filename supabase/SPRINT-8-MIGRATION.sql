-- GY-NEXUS Sprint 8 · SEO Studio
create extension if not exists pgcrypto;

create table if not exists public.seo_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content_url text,
  primary_keyword text not null,
  input_content text not null,
  overall_score integer not null default 0 check (overall_score between 0 and 100),
  report_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists seo_reports_created_at_idx on public.seo_reports(created_at desc);
create index if not exists seo_reports_keyword_idx on public.seo_reports(primary_keyword);

create table if not exists public.search_console_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  start_date date not null,
  end_date date not null,
  clicks numeric not null default 0,
  impressions numeric not null default 0,
  ctr numeric not null default 0,
  average_position numeric not null default 0,
  rows_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists search_console_snapshots_site_idx on public.search_console_snapshots(site_url, created_at desc);

alter table public.seo_reports enable row level security;
alter table public.search_console_snapshots enable row level security;
