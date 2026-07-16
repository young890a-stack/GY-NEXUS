-- =========================================================
-- GY FIRST RELEASE PRODUCTION 1.0 · BUILD 03
-- CUSTOMER PLATFORM
-- =========================================================
create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists marketing_opt_in boolean not null default false;

create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  type text not null default 'system' check (type in ('system','content','support','marketing')),
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.content_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id, content_id)
);

create table if not exists public.content_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  visitor_key text,
  content_id uuid not null,
  viewed_at timestamptz not null default now(),
  constraint content_views_actor_check check (user_id is not null or visitor_key is not null)
);

create index if not exists customer_notifications_user_idx on public.customer_notifications(user_id, is_read, created_at desc);
create index if not exists content_likes_content_idx on public.content_likes(content_id, created_at desc);
create index if not exists content_views_content_idx on public.content_views(content_id, viewed_at desc);
create index if not exists profiles_last_seen_idx on public.profiles(last_seen_at desc nulls last);

alter table public.customer_notifications enable row level security;
alter table public.content_likes enable row level security;
alter table public.content_views enable row level security;

-- 회원은 자신의 데이터만 관리합니다.
drop policy if exists "notifications_own_read" on public.customer_notifications;
create policy "notifications_own_read" on public.customer_notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "notifications_own_update" on public.customer_notifications;
create policy "notifications_own_update" on public.customer_notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "likes_own_all" on public.content_likes;
create policy "likes_own_all" on public.content_likes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "views_member_insert" on public.content_views;
create policy "views_member_insert" on public.content_views for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "views_member_read" on public.content_views;
create policy "views_member_read" on public.content_views for select to authenticated using (auth.uid() = user_id);

-- 기존 댓글 정책에 자신의 댓글 조회/수정을 추가합니다.
drop policy if exists "comments_own_read" on public.content_comments;
create policy "comments_own_read" on public.content_comments for select to authenticated using (auth.uid() = user_id or status = 'visible');
drop policy if exists "comments_own_update" on public.content_comments;
create policy "comments_own_update" on public.content_comments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 신규 회원 프로필 생성 시 관심분야까지 반영합니다.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name, role, interests, last_seen_at)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name',''),
    case when coalesce(new.raw_user_meta_data->>'role','member') in ('member','creator','admin') then coalesce(new.raw_user_meta_data->>'role','member') else 'member' end,
    coalesce(new.raw_user_meta_data->'interests','[]'::jsonb),
    now()
  )
  on conflict(id) do update set
    display_name = excluded.display_name,
    interests = case when jsonb_array_length(excluded.interests) > 0 then excluded.interests else public.profiles.interests end,
    last_seen_at = now(),
    updated_at = now();
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

comment on table public.customer_notifications is 'GY 회원 알림센터';
comment on table public.content_likes is '회원 콘텐츠 좋아요';
comment on table public.content_views is '회원·비회원 콘텐츠 조회 기록';
