create table if not exists public.gy_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid null,
  source_platform text not null default 'manual',
  source_url text null,
  product_title text not null,
  product_snapshot jsonb not null default '{}'::jsonb,
  analysis_result jsonb not null default '{}'::jsonb,
  content_plan jsonb not null default '{}'::jsonb,
  thumbnail_plan jsonb not null default '{}'::jsonb,
  quality_gates jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  owner_approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gy_pipeline_runs_status_idx on public.gy_pipeline_runs(status);
create index if not exists gy_pipeline_runs_created_at_idx on public.gy_pipeline_runs(created_at desc);

alter table public.gy_pipeline_runs enable row level security;

-- 서비스 역할 전용 운영을 기본값으로 사용합니다.
-- 회원별 접근이 필요해질 때 auth.uid() 기반 정책을 별도 추가하세요.
