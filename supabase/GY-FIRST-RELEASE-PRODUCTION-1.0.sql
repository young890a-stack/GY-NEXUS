-- =========================================================
-- GY FIRST RELEASE PRODUCTION 1.0
-- Customer Platform · Brand · Strategy · Quality · Operations
-- =========================================================
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'member' check (role in ('member','creator','admin')),
  interests jsonb not null default '[]'::jsonb,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id, content_id)
);

create table if not exists public.content_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  content_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'visible' check (status in ('visible','hidden','review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publishing_strategies (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','paused')),
  active_modes jsonb not null default '[]'::jsonb,
  quality_threshold integer not null default 90 check (quality_threshold between 0 and 100),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.publishing_strategies(platform, approval_status, active_modes)
values
  ('google','pending','["google_approval"]'::jsonb),
  ('naver','pending','["naver_approval"]'::jsonb)
on conflict (platform) do nothing;

create table if not exists public.quality_reviews (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,
  resource_id uuid,
  total_score integer not null check (total_score between 0 and 100),
  factuality_score integer not null default 0,
  readability_score integer not null default 0,
  seo_score integer not null default 0,
  brand_score integer not null default 0,
  compliance_score integer not null default 0,
  publishable boolean not null default false,
  issues jsonb not null default '[]'::jsonb,
  reviewer text not null default 'dream-y-quality-engine',
  created_at timestamptz not null default now()
);

create table if not exists public.brand_settings (
  id uuid primary key default gen_random_uuid(),
  brand_key text not null unique default 'gy-primary',
  company_name text not null default 'GY Labs',
  platform_name text not null default 'GY-NEXUS',
  os_name text not null default 'GY Company OS',
  ai_name text not null default 'Dream Y',
  tagline text not null default 'One Human. One AI Company.',
  primary_color text not null default '#4f46e5',
  secondary_color text not null default '#7c3aed',
  accent_color text not null default '#06b6d4',
  tone text not null default '신뢰감 있고 따뜻한 전문가',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.brand_settings(brand_key) values ('gy-primary') on conflict (brand_key) do nothing;

create table if not exists public.company_daily_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_date date not null unique default current_date,
  company_score integer not null default 0,
  headline text not null default '',
  priorities jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists comments_content_idx on public.content_comments(content_id, created_at desc);
create index if not exists inquiries_status_idx on public.customer_inquiries(status, created_at desc);
create index if not exists quality_reviews_resource_idx on public.quality_reviews(resource_type, resource_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.content_bookmarks enable row level security;
alter table public.content_comments enable row level security;
alter table public.customer_inquiries enable row level security;
alter table public.publishing_strategies enable row level security;
alter table public.quality_reviews enable row level security;
alter table public.brand_settings enable row level security;
alter table public.company_daily_briefs enable row level security;

-- 회원은 자신의 프로필과 활동만 관리합니다.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "bookmarks_own_all" on public.content_bookmarks;
create policy "bookmarks_own_all" on public.content_bookmarks for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "comments_public_read" on public.content_comments;
create policy "comments_public_read" on public.content_comments for select using (status = 'visible');
drop policy if exists "comments_member_insert" on public.content_comments;
create policy "comments_member_insert" on public.content_comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "inquiries_member_own" on public.customer_inquiries;
create policy "inquiries_member_own" on public.customer_inquiries for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name, role)
  values(new.id, coalesce(new.raw_user_meta_data->>'display_name',''), coalesce(new.raw_user_meta_data->>'role','member'))
  on conflict(id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
