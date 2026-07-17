-- GY-NEXUS AI COMPANY OS v2.0 · Sprint 5 Publish Center
create table if not exists public.publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  ai_content_id uuid references public.ai_contents(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  channel text not null default 'manual',
  title text not null,
  content text not null,
  status text not null default 'queued',
  scheduled_at timestamptz not null default now(),
  published_at timestamptz,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  external_id text,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.publishing_jobs add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.publishing_jobs add column if not exists max_attempts integer not null default 3;
alter table public.publishing_jobs drop constraint if exists publishing_jobs_status_check;
alter table public.publishing_jobs add constraint publishing_jobs_status_check check (status in ('queued','processing','published','retry','cancelled'));
create index if not exists publishing_jobs_status_idx on public.publishing_jobs(status, scheduled_at);
create index if not exists publishing_jobs_channel_idx on public.publishing_jobs(channel, created_at desc);
alter table public.publishing_jobs enable row level security;
drop policy if exists "authenticated can manage publishing jobs" on public.publishing_jobs;
create policy "authenticated can manage publishing jobs" on public.publishing_jobs for all to authenticated using (true) with check (true);
