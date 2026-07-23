-- GY-NEXUS V3.5 · Growth Commerce Engine
create extension if not exists pgcrypto;

create table if not exists public.growth_trends_v35 (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'google-trends-rss',
  region text not null default 'KR',
  keyword text not null,
  traffic bigint not null default 0,
  shopping_fit integer not null default 0 check (shopping_fit between 0 and 100),
  rank integer not null default 0,
  related_news jsonb not null default '[]'::jsonb,
  source_url text,
  observed_at timestamptz not null default now(),
  observed_date date generated always as ((observed_at at time zone 'UTC')::date) stored,
  raw jsonb not null default '{}'::jsonb,
  unique(region, keyword, observed_date)
);
create index if not exists growth_trends_v35_fit_idx on public.growth_trends_v35(observed_at desc, shopping_fit desc);

create table if not exists public.youtube_video_metrics_v35 (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  channel_title text,
  video_id text not null unique,
  title text not null default '',
  published_at timestamptz,
  thumbnail_url text,
  duration_seconds integer not null default 0,
  views bigint not null default 0,
  engaged_views bigint not null default 0,
  estimated_minutes_watched numeric not null default 0,
  average_view_duration numeric not null default 0,
  average_view_percentage numeric not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  subscribers_gained bigint not null default 0,
  subscribers_lost bigint not null default 0,
  attributed_clicks bigint not null default 0,
  conversions numeric not null default 0,
  revenue numeric not null default 0,
  commerce_score integer not null default 0 check (commerce_score between 0 and 100),
  synced_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);
create index if not exists youtube_video_metrics_v35_score_idx on public.youtube_video_metrics_v35(commerce_score desc, synced_at desc);

create table if not exists public.commerce_conversions_v35 (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  content_key text,
  channel text,
  video_id text,
  order_ref text,
  quantity numeric not null default 1,
  revenue numeric not null default 0,
  commission numeric not null default 0,
  currency text not null default 'KRW',
  converted_at timestamptz not null default now(),
  source text not null default 'manual-or-affiliate-import',
  raw jsonb not null default '{}'::jsonb
);
create index if not exists commerce_conversions_v35_video_idx on public.commerce_conversions_v35(video_id, converted_at desc);

create table if not exists public.commerce_learning_rules_v35 (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  rule_type text not null,
  segment text not null,
  direction text not null check (direction in ('prefer','avoid')),
  score integer not null default 0,
  lift_percent numeric not null default 0,
  sample_size integer not null default 0,
  confidence integer not null default 0,
  active boolean not null default false,
  evidence jsonb not null default '{}'::jsonb,
  recommendation text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.product_clicks add column if not exists content_key text;
alter table public.product_clicks add column if not exists channel text;
alter table public.product_clicks add column if not exists video_id text;
alter table public.product_clicks add column if not exists referrer text;
alter table public.product_clicks add column if not exists user_agent text;
create index if not exists product_clicks_video_idx on public.product_clicks(video_id, created_at desc);
create index if not exists product_clicks_content_idx on public.product_clicks(content_key, created_at desc);

alter table public.growth_trends_v35 enable row level security;
alter table public.youtube_video_metrics_v35 enable row level security;
alter table public.commerce_conversions_v35 enable row level security;
alter table public.commerce_learning_rules_v35 enable row level security;

comment on table public.growth_trends_v35 is 'Google Trends 급상승 수요와 쇼핑 적합도';
comment on table public.youtube_video_metrics_v35 is 'YouTube Analytics와 제휴 클릭·판매 통합 지표';
comment on table public.commerce_learning_rules_v35 is '실제 판매 성과로 학습한 다음 쇼츠 제작 규칙';
