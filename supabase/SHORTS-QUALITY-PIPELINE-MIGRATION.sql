-- =========================================================
-- GY-NEXUS · SHORTS QUALITY PIPELINE
-- Supabase Dashboard > SQL Editor에서 한 번 실행하세요.
-- 기존 데이터는 보존하며 새 품질검수 필드만 추가합니다.
-- =========================================================

alter table if exists public.video_projects
  add column if not exists reference_image_urls jsonb not null default '[]'::jsonb,
  add column if not exists quality_threshold integer not null default 85 check (quality_threshold between 80 and 95),
  add column if not exists max_image_retries integer not null default 2 check (max_image_retries between 1 and 2),
  add column if not exists render_approved boolean not null default false,
  add column if not exists render_approved_at timestamptz;

alter table if exists public.video_scenes
  add column if not exists image_candidates jsonb not null default '[]'::jsonb,
  add column if not exists selected_image_url text,
  add column if not exists selected_image_model text,
  add column if not exists quality_status text not null default 'pending',
  add column if not exists quality_score integer,
  add column if not exists quality_report jsonb not null default '{}'::jsonb,
  add column if not exists image_retry_count integer not null default 0,
  add column if not exists quality_approved_at timestamptz;

create index if not exists video_scenes_quality_idx
  on public.video_scenes(project_id, quality_status, scene_number);

comment on column public.video_projects.render_approved is
  '모든 장면 이미지 품질검수 통과 후 대표가 Runway 유료 생성을 승인했는지 여부';
comment on column public.video_scenes.quality_report is
  '상품 일치도, 시각 오류, 자연스러움, 구도, 과장 위험 점수와 수정 사유';
