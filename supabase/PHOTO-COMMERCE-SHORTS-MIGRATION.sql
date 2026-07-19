-- GY-NEXUS 사진 한 장 쇼츠 모드
-- 기존 Creative Studio Pro 설치본에 15초 길이를 추가합니다.

alter table if exists public.video_projects
  drop constraint if exists video_projects_duration_seconds_check;

alter table if exists public.video_projects
  add constraint video_projects_duration_seconds_check
  check (duration_seconds in (15,20,25,30));

comment on column public.video_projects.settings is
  '사진 한 장/프리미엄 소스 모드, 자막·썸네일·효과음 설정, 판매 패키지와 AI 음성 URL';
