-- GY-NEXUS AI COMPANY OS V2.0 · Sprint 4 Creative Studio
-- Supabase SQL Editor에서 한 번 실행하세요.
create extension if not exists pgcrypto;

create table if not exists public.creative_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('image','video')),
  title text not null,
  prompt text not null,
  provider text not null,
  provider_task_id text,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb not null default '{}'::jsonb,
  asset_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists creative_jobs_created_at_idx
  on public.creative_jobs(created_at desc);
create index if not exists creative_jobs_status_idx
  on public.creative_jobs(status, created_at desc);

alter table public.creative_jobs enable row level security;
drop policy if exists "authenticated can manage creative jobs" on public.creative_jobs;
create policy "authenticated can manage creative jobs"
  on public.creative_jobs for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creative-assets',
  'creative-assets',
  true,
  104857600,
  array['image/png','image/jpeg','image/webp','video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can view creative assets" on storage.objects;
create policy "public can view creative assets"
  on storage.objects for select using (bucket_id = 'creative-assets');
