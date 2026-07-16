-- GY-NEXUS Sprint 6 전용 추가 SQL
-- Supabase Dashboard > SQL Editor > New query에 전체 복사 후 Run

create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','processing','retry','completed','failed','cancelled')),
  current_step text not null default 'queued',
  config jsonb not null default '{}'::jsonb,
  result_data jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists automation_jobs_queue_idx on public.automation_jobs(status, scheduled_at);
create index if not exists automation_jobs_created_idx on public.automation_jobs(created_at desc);
alter table public.automation_jobs enable row level security;
drop policy if exists "authenticated can manage automation jobs" on public.automation_jobs;
create policy "authenticated can manage automation jobs" on public.automation_jobs for all to authenticated using (true) with check (true);
drop policy if exists "public can manage automation jobs" on public.automation_jobs;
create policy "public can manage automation jobs" on public.automation_jobs for all to anon using (true) with check (true);

create table if not exists public.automation_job_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.automation_jobs(id) on delete cascade,
  run_id uuid references public.automation_runs(id) on delete set null,
  step text not null,
  status text not null check (status in ('running','completed','failed','skipped')),
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists automation_job_logs_job_idx on public.automation_job_logs(job_id, created_at desc);
create index if not exists automation_job_logs_created_idx on public.automation_job_logs(created_at desc);
alter table public.automation_job_logs enable row level security;
drop policy if exists "authenticated can manage automation job logs" on public.automation_job_logs;
create policy "authenticated can manage automation job logs" on public.automation_job_logs for all to authenticated using (true) with check (true);
drop policy if exists "public can manage automation job logs" on public.automation_job_logs;
create policy "public can manage automation job logs" on public.automation_job_logs for all to anon using (true) with check (true);
