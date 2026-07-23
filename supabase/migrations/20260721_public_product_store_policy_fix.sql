-- GY-NEXUS 공개 상품관 정책 중복 오류 수정
-- Supabase SQL Editor에서 전체 실행하세요.

begin;

drop policy if exists "public can read products" on public.products;
drop policy if exists "public can insert products" on public.products;
drop policy if exists "public can update products" on public.products;
drop policy if exists "public can delete products" on public.products;
drop policy if exists "public can read published products" on public.products;

create policy "public can read published products"
  on public.products for select to anon, authenticated
  using (is_public = true and status = 'published');

drop policy if exists "public can read clicks" on public.product_clicks;
drop policy if exists "public can insert clicks" on public.product_clicks;

commit;

-- 확인용: products에는 public can read published products만 공개 정책으로 남아야 합니다.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('products', 'product_clicks')
order by tablename, policyname;
