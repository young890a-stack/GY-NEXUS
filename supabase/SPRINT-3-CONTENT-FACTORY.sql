-- GY-NEXUS AI Company OS v2.0 · Sprint 3 Content Factory
create table if not exists public.content_factory_runs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('processing','completed','failed')),
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists content_factory_runs_created_at_idx on public.content_factory_runs(created_at desc);
alter table public.content_factory_runs enable row level security;
drop policy if exists "authenticated can manage content factory runs" on public.content_factory_runs;
create policy "authenticated can manage content factory runs" on public.content_factory_runs for all to authenticated using (true) with check (true);
drop policy if exists "public can insert content factory runs" on public.content_factory_runs;
create policy "public can insert content factory runs" on public.content_factory_runs for insert with check (true);
drop policy if exists "public can read content factory runs" on public.content_factory_runs;
create policy "public can read content factory runs" on public.content_factory_runs for select using (true);
