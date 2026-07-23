-- GY-NEXUS 공개 상품관 운영형 마이그레이션
-- 실행 위치: Supabase Dashboard > SQL Editor
-- 기존 판매 상품은 계속 공개되도록 자동 전환합니다.

alter table public.products add column if not exists slug text;
alter table public.products add column if not exists category text not null default 'etc';
alter table public.products add column if not exists status text not null default 'draft';
alter table public.products add column if not exists is_public boolean not null default false;
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists quality_score integer not null default 0;
alter table public.products add column if not exists target_audience text;
alter table public.products add column if not exists selling_points jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists usage_tips text;
alter table public.products add column if not exists cautions text;
alter table public.products add column if not exists short_video_url text;
alter table public.products add column if not exists long_video_url text;
alter table public.products add column if not exists review_url text;
alter table public.products add column if not exists link_status text not null default 'unchecked';
alter table public.products add column if not exists price_checked_at timestamptz;
alter table public.products add column if not exists published_at timestamptz;
alter table public.products add column if not exists updated_at timestamptz not null default now();

update public.products
set slug = coalesce(
  nullif(trim(both '-' from lower(regexp_replace(title, '[^0-9A-Za-z가-힣]+', '-', 'g'))), ''),
  'product'
) || '-' || left(replace(id::text, '-', ''), 8)
where slug is null or btrim(slug) = '';

-- 기존에 대표님이 등록한 판매 상품은 공개 상태를 유지합니다.
update public.products
set
  status = 'published',
  is_public = true,
  quality_score = case when quality_score = 0 then 70 else quality_score end,
  published_at = coalesce(published_at, created_at),
  updated_at = now();

alter table public.products alter column slug set not null;
create unique index if not exists products_slug_unique_idx on public.products(slug);
create index if not exists products_public_rank_idx
  on public.products(is_public, status, is_featured desc, quality_score desc, published_at desc);
create index if not exists products_category_idx on public.products(category);

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check
  check (status in ('draft','review','published','paused','sold_out','link_error'));

alter table public.products drop constraint if exists products_quality_score_check;
alter table public.products add constraint products_quality_score_check
  check (quality_score between 0 and 100);

alter table public.products drop constraint if exists products_link_status_check;
alter table public.products add constraint products_link_status_check
  check (link_status in ('unchecked','healthy','broken','sold_out'));

alter table public.product_clicks add column if not exists source text not null default 'direct';
alter table public.product_clicks add column if not exists device_type text not null default 'unknown';
alter table public.product_clicks add column if not exists referrer_host text;
create index if not exists product_clicks_source_created_idx
  on public.product_clicks(source, created_at desc);

-- 공개 방문자는 승인된 상품만 읽을 수 있습니다.
drop policy if exists "public can read products" on public.products;
drop policy if exists "public can insert products" on public.products;
drop policy if exists "public can update products" on public.products;
drop policy if exists "public can delete products" on public.products;
drop policy if exists "public can read published products" on public.products;
create policy "public can read published products"
  on public.products for select to anon, authenticated
  using (is_public = true and status = 'published');

-- 클릭은 공개 API가 service role로 기록하므로 방문자 직접 접근을 차단합니다.
drop policy if exists "public can read clicks" on public.product_clicks;
drop policy if exists "public can insert clicks" on public.product_clicks;
