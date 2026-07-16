create extension if not exists pgcrypto;

create table if not exists public.video_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  product_name text not null,
  product_description text not null default '',
  master_prompt text not null default '',
  source_image_url text,
  duration_seconds integer not null check (duration_seconds in (20,25,30)),
  scene_count integer not null,
  ratio text not null default '720:1280',
  style text not null default 'cinematic-product',
  subtitle_mode text not null default 'korean',
  voice_mode text not null default 'female',
  music_mood text not null default 'modern-corporate',
  status text not null default 'planned',
  final_video_url text,
  error_message text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.video_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects(id) on delete cascade,
  scene_number integer not null,
  start_second integer not null,
  end_second integer not null,
  duration_seconds integer not null default 5,
  role text not null,
  prompt text not null,
  narration text not null default '',
  subtitle_text text not null default '',
  status text not null default 'pending',
  video_url text,
  provider_task_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(project_id, scene_number)
);

create table if not exists public.video_render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects(id) on delete cascade,
  worker_job_id text,
  status text not null default 'queued',
  request_payload jsonb not null default '{}'::jsonb,
  output_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists video_projects_created_at_idx on public.video_projects(created_at desc);
create index if not exists video_scenes_project_idx on public.video_scenes(project_id, scene_number);
create index if not exists video_render_jobs_project_idx on public.video_render_jobs(project_id, created_at desc);

alter table public.video_projects enable row level security;
alter table public.video_scenes enable row level security;
alter table public.video_render_jobs enable row level security;
