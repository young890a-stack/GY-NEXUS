-- GY-NEXUS · Affiliate Product Sourcing V1
-- Supabase Dashboard > SQL Editor에서 이 파일 전체를 한 번 실행하세요.

create extension if not exists "pgcrypto";

alter table if exists public.trend_products add column if not exists external_id text;
alter table if exists public.trend_products add column if not exists source_verified boolean not null default false;
alter table if exists public.trend_products add column if not exists link_status text not null default 'unconfirmed';
alter table if exists public.trend_products add column if not exists link_checked_at timestamptz;
alter table if exists public.trend_products add column if not exists last_seen_at timestamptz;
alter table if exists public.trend_products add column if not exists data_quality_score integer not null default 0;
alter table if exists public.trend_products add column if not exists provider_mode text;

alter table if exists public.trend_products drop constraint if exists trend_products_status_check;
alter table if exists public.trend_products
  add constraint trend_products_status_check
  check (status in ('candidate','analyzed','approved','held','rejected'));

alter table if exists public.trend_products drop constraint if exists trend_products_link_status_check;
alter table if exists public.trend_products
  add constraint trend_products_link_status_check
  check (link_status in ('verified','provider-link','unconfirmed','invalid'));

alter table if exists public.trend_products drop constraint if exists trend_products_data_quality_score_check;
alter table if exists public.trend_products
  add constraint trend_products_data_quality_score_check
  check (data_quality_score between 0 and 100);

create index if not exists trend_products_provider_mode_idx
  on public.trend_products(platform, provider_mode, last_seen_at desc);
create index if not exists trend_products_link_quality_idx
  on public.trend_products(link_status, data_quality_score desc);
create index if not exists products_affiliate_url_idx
  on public.products(affiliate_url);

create table if not exists public.affiliate_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('coupang','temu')),
  mode text not null,
  source_name text not null,
  status text not null default 'processing' check (status in ('processing','completed','partial','failed')),
  requested_count integer not null default 0,
  accepted_count integer not null default 0,
  rejected_count integer not null default 0,
  error_summary text,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_sync_runs_provider_created_idx
  on public.affiliate_sync_runs(provider, created_at desc);

alter table public.affiliate_sync_runs enable row level security;
drop policy if exists "owner can manage affiliate sync runs" on public.affiliate_sync_runs;
create policy "owner can manage affiliate sync runs"
  on public.affiliate_sync_runs for all to authenticated using (true) with check (true);

comment on table public.affiliate_sync_runs is
  '쿠팡 승인 API와 Temu 공유 링크 수집의 성공·부분성공·실패 감사 기록';
comment on column public.trend_products.source_verified is
  '공식 API 응답 또는 공유 링크 추적 근거를 확인했는지 표시';
comment on column public.trend_products.data_quality_score is
  '출처·상품명·이미지·가격·링크 근거의 완성도 점수이며 판매 가능성 보장이 아님';
