-- GY-NEXUS V3-2 Gemini Pro China Discovery Engine
-- 재실행 가능한(idempotent) 추가 마이그레이션

begin;

create extension if not exists "pgcrypto";

alter table if exists public.china_discovery_runs
  add column if not exists gemini_provider text;
alter table if exists public.china_discovery_runs
  add column if not exists gemini_model text;
alter table if exists public.china_discovery_runs
  add column if not exists analyzed_candidate_count integer not null default 0;
alter table if exists public.china_discovery_runs
  add column if not exists collector_status text not null default 'idle';
alter table if exists public.china_discovery_runs
  add column if not exists collector_last_seen_at timestamptz;

alter table if exists public.china_video_candidates
  add column if not exists gemini_status text not null default 'pending';
alter table if exists public.china_video_candidates
  add column if not exists gemini_score integer not null default 0;
alter table if exists public.china_video_candidates
  add column if not exists gemini_analysis jsonb not null default '{}'::jsonb;
alter table if exists public.china_video_candidates
  add column if not exists analyzed_at timestamptz;

create table if not exists public.china_collector_sessions_v3 (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.china_discovery_runs(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active','completed','expired','revoked')),
  target_candidate_count integer not null default 150 check (target_candidate_count between 20 and 300),
  collected_candidate_count integer not null default 0,
  last_platform text check (last_platform is null or last_platform in ('douyin','xiaohongshu')),
  last_keyword text,
  last_seen_at timestamptz,
  expires_at timestamptz not null default (now() + interval '12 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists china_collector_sessions_v3_run_idx
  on public.china_collector_sessions_v3(run_id, status, created_at desc);
create index if not exists china_video_candidates_gemini_idx
  on public.china_video_candidates(run_id, gemini_status, total_intelligence_score desc);

alter table public.china_collector_sessions_v3 enable row level security;

-- 운영 API는 SUPABASE_SERVICE_ROLE_KEY로만 접근합니다.
-- 브라우저 확장 프로그램에는 12시간짜리 일회성 수집 토큰만 전달합니다.

commit;
