-- GY-NEXUS Sprint 10 · AI Company OS
create table if not exists public.company_daily_briefs (
  id uuid primary key default gen_random_uuid(),
  report text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.system_incidents (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  title text not null,
  detail text,
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists company_daily_briefs_created_at_idx on public.company_daily_briefs(created_at desc);
create index if not exists system_incidents_status_idx on public.system_incidents(status, created_at desc);

alter table public.company_daily_briefs enable row level security;
alter table public.system_incidents enable row level security;
