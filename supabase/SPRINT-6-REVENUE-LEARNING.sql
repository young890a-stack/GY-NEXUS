-- GY-NEXUS Sprint 6 · Revenue Dashboard + Learning Engine
create extension if not exists pgcrypto;
create table if not exists public.revenue_events (
 id uuid primary key default gen_random_uuid(),
 channel text not null,
 content_id text,
 title text,
 views bigint not null default 0,
 clicks bigint not null default 0,
 conversions bigint not null default 0,
 revenue numeric(14,2) not null default 0,
 currency text not null default 'KRW',
 occurred_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists revenue_events_occurred_at_idx on public.revenue_events(occurred_at desc);
create index if not exists revenue_events_channel_idx on public.revenue_events(channel);
create table if not exists public.learning_rules (
 id uuid primary key default gen_random_uuid(),
 rule_key text unique not null,
 rule_type text not null,
 weight numeric(8,4) not null default 0,
 confidence numeric(5,2) not null default 0,
 evidence_count integer not null default 0,
 payload jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.ai_recommendations (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 reason text not null,
 channel text,
 recommended_publish_at timestamptz,
 score integer not null default 0 check (score between 0 and 100),
 predicted_views bigint,
 predicted_ctr numeric(6,2),
 predicted_revenue numeric(14,2),
 confidence numeric(5,2),
 status text not null default 'active',
 evidence jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.forecast_snapshots (
 id uuid primary key default gen_random_uuid(),
 period_start date not null,
 period_end date not null,
 predicted_views bigint not null default 0,
 predicted_ctr numeric(6,2) not null default 0,
 predicted_revenue numeric(14,2) not null default 0,
 confidence numeric(5,2) not null default 0,
 scenario text not null default 'base',
 model_version text not null default 's6-baseline-v1',
 inputs jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.revenue_events enable row level security;
alter table public.learning_rules enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.forecast_snapshots enable row level security;
-- 서버 API는 service role을 사용합니다. 공개 익명 쓰기 정책은 의도적으로 만들지 않습니다.
