-- GY-NEXUS 한국형 자동 쇼핑 쇼츠 제작기
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요. 재실행해도 안전합니다.

create extension if not exists pgcrypto;

create table if not exists public.shopping_shorts_runs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid,
  product_url text,
  product_name text not null,
  product_description text not null,
  product_image_url text,
  price_text text,
  product_analysis jsonb not null default '{}'::jsonb,
  input_snapshot jsonb not null default '{}'::jsonb,
  profit_estimate jsonb not null default '{}'::jsonb,
  learned_patterns_used jsonb not null default '[]'::jsonb,
  status text not null default 'generating',
  quality_threshold integer not null default 86 check (quality_threshold between 80 and 95),
  max_regenerations integer not null default 2 check (max_regenerations between 1 and 2),
  approved_variant_id uuid,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_shorts_runs_status_check
    check (status in ('generating','quality_review','ready','partial','failed','archived'))
);

create table if not exists public.shopping_shorts_variants (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.shopping_shorts_runs(id) on delete cascade,
  variant_key text not null,
  hook_index integer not null check (hook_index between 1 and 3),
  hook_style text not null,
  duration_seconds integer not null check (duration_seconds in (15,20,30)),
  hook text not null,
  title text not null,
  description text not null,
  hashtags jsonb not null default '[]'::jsonb,
  script text not null,
  cta text not null,
  thumbnail jsonb not null default '{}'::jsonb,
  scenes jsonb not null default '[]'::jsonb,
  srt text not null,
  plain_subtitles text not null,
  quality_report jsonb not null default '{}'::jsonb,
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  quality_status text not null default 'blocked',
  regeneration_count integer not null default 0,
  fingerprint text not null,
  video_project_id uuid,
  final_video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, variant_key),
  constraint shopping_shorts_variants_status_check
    check (quality_status in ('approved','blocked','producing','rendered','published'))
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shopping_shorts_runs_approved_variant_fkey'
  ) then
    alter table public.shopping_shorts_runs
      add constraint shopping_shorts_runs_approved_variant_fkey
      foreign key (approved_variant_id)
      references public.shopping_shorts_variants(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.shopping_shorts_metrics (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.shopping_shorts_variants(id) on delete cascade,
  channel text not null check (channel in ('youtube','instagram','manual')),
  external_content_id text,
  views bigint not null default 0,
  impressions bigint not null default 0,
  first_three_second_rate numeric(7,3) not null default 0,
  average_view_percent numeric(7,3) not null default 0,
  completion_rate numeric(7,3) not null default 0,
  saves bigint not null default 0,
  shares bigint not null default 0,
  clicks bigint not null default 0,
  orders bigint not null default 0,
  revenue numeric(14,2) not null default 0,
  ad_spend numeric(14,2) not null default 0,
  performance_score numeric(7,2) not null default 0,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(variant_id, channel)
);

create table if not exists public.shopping_shorts_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_key text not null unique,
  hook_style text not null,
  recommendation text not null,
  score numeric(7,2) not null default 0,
  sample_size integer not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists shopping_shorts_runs_created_idx
  on public.shopping_shorts_runs(created_at desc);
create index if not exists shopping_shorts_variants_run_idx
  on public.shopping_shorts_variants(run_id, hook_index, duration_seconds);
create index if not exists shopping_shorts_variants_quality_idx
  on public.shopping_shorts_variants(quality_status, quality_score desc);
create index if not exists shopping_shorts_variants_fingerprint_idx
  on public.shopping_shorts_variants(fingerprint);
create index if not exists shopping_shorts_metrics_score_idx
  on public.shopping_shorts_metrics(performance_score desc, measured_at desc);
create index if not exists shopping_shorts_patterns_active_idx
  on public.shopping_shorts_patterns(active, score desc);

alter table public.shopping_shorts_runs enable row level security;
alter table public.shopping_shorts_variants enable row level security;
alter table public.shopping_shorts_metrics enable row level security;
alter table public.shopping_shorts_patterns enable row level security;

-- 브라우저의 익명 키로는 접근하지 않습니다.
-- 인증된 관리자 API가 service role로만 읽고 씁니다.
revoke all on public.shopping_shorts_runs from anon, authenticated;
revoke all on public.shopping_shorts_variants from anon, authenticated;
revoke all on public.shopping_shorts_metrics from anon, authenticated;
revoke all on public.shopping_shorts_patterns from anon, authenticated;

