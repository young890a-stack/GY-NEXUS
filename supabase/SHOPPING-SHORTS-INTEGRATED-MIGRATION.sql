-- GY-NEXUS 쇼핑 쇼츠 상품화 센터 통합판
-- 신규 테이블 없이 video_projects.settings JSONB에 권리, 트렌드, 플랫폼 패키지, 승인 결과를 저장합니다.

alter table if exists public.video_projects
  drop constraint if exists video_projects_duration_seconds_check;

alter table if exists public.video_projects
  add constraint video_projects_duration_seconds_check
  check (duration_seconds in (15,20,25,30));

comment on column public.video_projects.settings is
  '상품 소스 모드, 제휴 링크, GY 상품번호, 중국 탐색 설계, 소재 권리, 플랫폼 패키지, 정확한 SRT 큐, 대표 콘텐츠 승인';

