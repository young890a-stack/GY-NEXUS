-- =========================================================
-- GY-NEXUS AI COMPANY OS v2.0 FINAL
-- Final operational tables and compatibility repair migration
-- Existing data is preserved. Safe to run more than once.
-- =========================================================
create extension if not exists pgcrypto;

create table if not exists public.system_audit_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info' check (level in ('info','warning','error','critical')),
  source text not null default 'system',
  action text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists system_audit_logs_created_at_idx on public.system_audit_logs(created_at desc);
create index if not exists system_audit_logs_level_idx on public.system_audit_logs(level);

create table if not exists public.system_backups (
  id uuid primary key default gen_random_uuid(),
  backup_type text not null default 'manual',
  status text not null default 'pending' check (status in ('pending','running','success','failed')),
  storage_path text,
  size_bytes bigint,
  checksum text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists system_backups_created_at_idx on public.system_backups(created_at desc);

create table if not exists public.integration_health (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null default 'unknown' check (status in ('unknown','connected','degraded','disconnected')),
  last_checked_at timestamptz not null default now(),
  latency_ms integer,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create unique index if not exists integration_health_provider_uidx on public.integration_health(provider);

-- Sprint 6 revenue compatibility repair
create table if not exists public.revenue_events (id uuid primary key default gen_random_uuid());
alter table public.revenue_events
  add column if not exists channel text,
  add column if not exists content_id text,
  add column if not exists title text,
  add column if not exists views bigint not null default 0,
  add column if not exists clicks bigint not null default 0,
  add column if not exists conversions bigint not null default 0,
  add column if not exists revenue numeric(14,2) not null default 0,
  add column if not exists currency text not null default 'KRW',
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();
update public.revenue_events set channel='unknown' where channel is null;
alter table public.revenue_events alter column channel set not null;
create index if not exists revenue_events_occurred_at_idx on public.revenue_events(occurred_at desc);
create index if not exists revenue_events_channel_idx on public.revenue_events(channel);

alter table public.system_audit_logs enable row level security;
alter table public.system_backups enable row level security;
alter table public.integration_health enable row level security;
alter table public.revenue_events enable row level security;

comment on table public.system_audit_logs is 'GY-NEXUS v2.0 operational audit log';
comment on table public.system_backups is 'GY-NEXUS v2.0 backup job registry';
comment on table public.integration_health is 'External integration health snapshots';
