-- GY-NEXUS Sprint 11.5 · Universal Product Import Engine
alter table if exists public.affiliate_imports
  add column if not exists extraction_method text not null default 'manual',
  add column if not exists blocked_reason text,
  add column if not exists confidence jsonb not null default '{"title":0,"description":0,"image":0,"price":0}'::jsonb;

create index if not exists affiliate_imports_extraction_method_idx
  on public.affiliate_imports(extraction_method);

comment on column public.affiliate_imports.extraction_method is
  'metadata, redirect-only, manual 중 하나. 접근 제한 우회 없이 허용된 정보만 사용.';
comment on column public.affiliate_imports.blocked_reason is
  '자동 추출 실패 또는 정책 제한 사유. 직접 입력 모드 전환 안내에 사용.';
comment on column public.affiliate_imports.confidence is
  '상품명, 설명, 이미지, 가격 정보의 0~100 신뢰도 표시.';
