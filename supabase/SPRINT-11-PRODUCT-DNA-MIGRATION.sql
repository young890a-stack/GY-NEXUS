-- GY-NEXUS Sprint 11 · Product DNA Engine (safe migration)
create extension if not exists pgcrypto;

create table if not exists public.affiliate_imports (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  resolved_url text not null,
  platform text not null default 'other',
  product_title text not null,
  product_description text not null default '',
  price_text text not null default '',
  source_image_url text,
  extraction_status text not null default 'manual',
  rights_mode text not null default 'transformative-reference-only',
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_dna_campaigns (
  id uuid primary key default gen_random_uuid(),
  affiliate_import_id uuid references public.affiliate_imports(id) on delete set null,
  video_project_id uuid,
  product_name text not null,
  campaign_style text not null,
  target_audience text not null default '',
  duration_seconds integer not null check (duration_seconds in (20,25,30)),
  dna jsonb not null default '{}'::jsonb,
  generated_image_url text,
  blog_title text,
  blog_html text,
  shorts_title text,
  shorts_description text,
  hashtags jsonb not null default '[]'::jsonb,
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.video_projects') is not null
     and not exists (select 1 from pg_constraint where conname='product_dna_campaigns_video_project_id_fkey') then
    alter table public.product_dna_campaigns
      add constraint product_dna_campaigns_video_project_id_fkey
      foreign key (video_project_id) references public.video_projects(id) on delete set null;
  end if;
end $$;

create index if not exists affiliate_imports_created_at_idx on public.affiliate_imports(created_at desc);
create index if not exists product_dna_campaigns_created_at_idx on public.product_dna_campaigns(created_at desc);

alter table public.affiliate_imports enable row level security;
alter table public.product_dna_campaigns enable row level security;

comment on table public.affiliate_imports is '제휴링크 공개 메타데이터 및 수동 보완 정보. 원본 콘텐츠 복제용이 아님.';
comment on column public.affiliate_imports.rights_mode is '원본은 상품 확인 참고로만 사용하고 신규 광고 비주얼을 생성.';
