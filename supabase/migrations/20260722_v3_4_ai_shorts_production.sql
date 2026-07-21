-- GY-NEXUS V3-4 AI Shorts Production Engine
-- V3-3 완료 후보를 A/B/C 한국형 쇼츠 제작 프로젝트로 전환
-- 재실행 가능한 추가 마이그레이션

begin;

create extension if not exists "pgcrypto";

create table if not exists public.shorts_production_batches_v34 (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.china_discovery_runs(id) on delete cascade,
  candidate_id uuid not null references public.china_video_candidates(id) on delete cascade,
  scene_job_id uuid not null references public.china_scene_analysis_jobs_v3(id) on delete cascade,
  product_name text not null,
  product_description text not null,
  product_image_url text not null,
  affiliate_url text,
  duration_seconds integer not null default 20 check (duration_seconds in (15,20,25,30)),
  voice_preset text not null default 'marin' check (voice_preset in ('marin','coral','shimmer','cedar','onyx','echo')),
  quality_threshold integer not null default 90 check (quality_threshold between 88 and 95),
  provider text,
  model text,
  status text not null default 'planning'
    check (status in ('planning','project_ready','production','quality_ready','approved','failed')),
  source_snapshot jsonb not null default '{}'::jsonb,
  approved_variant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shorts_production_variants_v34 (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.shorts_production_batches_v34(id) on delete cascade,
  variant_key text not null check (variant_key in ('A','B','C')),
  variant_type text not null check (variant_type in ('problem-solution','visual-surprise','comparison-proof')),
  title text not null,
  hook text,
  strategy_summary text,
  target_audience text,
  plan jsonb not null default '{}'::jsonb,
  plan_score integer not null default 0 check (plan_score between 0 and 100),
  quality_threshold integer not null default 90 check (quality_threshold between 88 and 95),
  video_project_id uuid references public.video_projects(id) on delete set null,
  status text not null default 'planned'
    check (status in (
      'planned','plan_review','project_ready','images_generating','images_ready',
      'runway_approved','clips_ready','rendering','quality_review','quality_passed',
      'revision_required','approved','failed'
    )),
  final_score integer not null default 0 check (final_score between 0 and 100),
  quality_report jsonb not null default '{}'::jsonb,
  final_video_url text,
  thumbnail_url text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id, variant_key)
);

-- approved_variant_id FK is added after the variant table exists.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shorts_production_batches_v34_approved_variant_fkey'
  ) then
    alter table public.shorts_production_batches_v34
      add constraint shorts_production_batches_v34_approved_variant_fkey
      foreign key (approved_variant_id)
      references public.shorts_production_variants_v34(id)
      on delete set null;
  end if;
end $$;

create index if not exists shorts_production_batches_v34_run_idx
  on public.shorts_production_batches_v34(run_id, created_at desc);
create index if not exists shorts_production_batches_v34_candidate_idx
  on public.shorts_production_batches_v34(candidate_id, created_at desc);
create index if not exists shorts_production_variants_v34_batch_idx
  on public.shorts_production_variants_v34(batch_id, variant_key);
create index if not exists shorts_production_variants_v34_project_idx
  on public.shorts_production_variants_v34(video_project_id);
create index if not exists shorts_production_variants_v34_status_idx
  on public.shorts_production_variants_v34(status, final_score desc);

alter table public.shorts_production_batches_v34 enable row level security;
alter table public.shorts_production_variants_v34 enable row level security;

-- 운영 API는 SUPABASE_SERVICE_ROLE_KEY로만 접근합니다.

commit;
