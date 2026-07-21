-- GY-NEXUS V3-3 Gemini Multimodal Scene Intelligence
-- 권리 확인된 영상만 저장·프레임 추출·Gemini 정밀분석

begin;

alter table if exists public.china_video_candidates
  add column if not exists selected_for_scene_analysis boolean not null default false;
alter table if exists public.china_video_candidates
  add column if not exists scene_analysis_rank integer;
alter table if exists public.china_video_candidates
  add column if not exists scene_analysis_status text not null default 'not_selected';
alter table if exists public.china_video_candidates
  add column if not exists scene_analysis_score integer not null default 0;
alter table if exists public.china_video_candidates
  add column if not exists scene_analysis_summary text;
alter table if exists public.china_video_candidates
  add column if not exists scene_analysis jsonb not null default '{}'::jsonb;
alter table if exists public.china_video_candidates
  add column if not exists source_video_url text;
alter table if exists public.china_video_candidates
  add column if not exists source_video_mime text;
alter table if exists public.china_video_candidates
  add column if not exists source_video_bytes bigint;
alter table if exists public.china_video_candidates
  add column if not exists source_duration_seconds numeric(10,3);
alter table if exists public.china_video_candidates
  add column if not exists analysis_frame_urls jsonb not null default '[]'::jsonb;
alter table if exists public.china_video_candidates
  add column if not exists rights_evidence jsonb not null default '{}'::jsonb;
alter table if exists public.china_video_candidates
  add column if not exists rights_verified_at timestamptz;

create table if not exists public.china_scene_analysis_jobs_v3 (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.china_discovery_runs(id) on delete cascade,
  candidate_id uuid not null unique references public.china_video_candidates(id) on delete cascade,
  rank integer,
  status text not null default 'awaiting_source'
    check (status in ('awaiting_source','staging','frames_ready','analyzing','manual_ready','completed','failed')),
  source_mode text not null default 'none'
    check (source_mode in ('none','verified-remote','uploaded','gemini-pro-manual')),
  source_video_url text,
  source_video_mime text,
  source_video_bytes bigint,
  duration_seconds numeric(10,3),
  frame_urls jsonb not null default '[]'::jsonb,
  frame_timestamps jsonb not null default '[]'::jsonb,
  rights_status text not null default 'unverified'
    check (rights_status in ('owned','seller-provided','affiliate-provided','permission-confirmed','unverified')),
  rights_evidence jsonb not null default '{}'::jsonb,
  model text,
  provider text,
  analysis_score integer not null default 0,
  analysis_result jsonb not null default '{}'::jsonb,
  error_message text,
  attempts integer not null default 0,
  worker_job_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.china_scene_segments_v3 (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.china_scene_analysis_jobs_v3(id) on delete cascade,
  candidate_id uuid not null references public.china_video_candidates(id) on delete cascade,
  scene_index integer not null,
  start_second numeric(10,3) not null default 0,
  end_second numeric(10,3) not null default 0,
  role text not null default 'other',
  visual_description text,
  camera_direction text,
  on_screen_text text,
  audio_narration text,
  emotion text,
  product_visibility_score integer not null default 0,
  hook_score integer not null default 0,
  proof_score integer not null default 0,
  copyright_risk_score integer not null default 0,
  reusable_pattern text,
  recreate_direction text,
  evidence text,
  representative_timestamp numeric(10,3),
  representative_frame_url text,
  created_at timestamptz not null default now(),
  unique(job_id, scene_index)
);

create index if not exists china_scene_analysis_jobs_v3_run_idx
  on public.china_scene_analysis_jobs_v3(run_id, status, rank);
create index if not exists china_scene_analysis_jobs_v3_candidate_idx
  on public.china_scene_analysis_jobs_v3(candidate_id);
create index if not exists china_scene_segments_v3_job_idx
  on public.china_scene_segments_v3(job_id, scene_index);
create index if not exists china_video_candidates_scene_selected_idx
  on public.china_video_candidates(run_id, selected_for_scene_analysis, scene_analysis_rank);

alter table public.china_scene_analysis_jobs_v3 enable row level security;
alter table public.china_scene_segments_v3 enable row level security;

drop view if exists public.v_scene_intelligence_top30_v3;
create view public.v_scene_intelligence_top30_v3 as
select
  c.id as candidate_id,
  c.run_id,
  c.platform,
  c.title,
  c.url,
  c.thumbnail_url,
  c.total_intelligence_score,
  c.gemini_score,
  c.scene_analysis_rank,
  c.scene_analysis_status,
  c.scene_analysis_score,
  j.id as job_id,
  j.status as job_status,
  j.rights_status,
  j.source_video_url,
  j.duration_seconds,
  j.frame_urls,
  j.analysis_result
from public.china_video_candidates c
left join public.china_scene_analysis_jobs_v3 j on j.candidate_id = c.id
where c.selected_for_scene_analysis = true;

commit;
