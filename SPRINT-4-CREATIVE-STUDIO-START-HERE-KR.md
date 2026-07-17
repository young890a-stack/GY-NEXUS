# Sprint 4 · Creative Studio 시작 안내

## 이번 교체본에서 실제 추가된 것

- `/admin/creative-studio` 이미지·영상 제작 화면
- OpenAI Image API 연동 및 1:1 / 가로 / 세로 이미지 생성 기반
- Runway 텍스트→영상 및 이미지→영상 연동
- Supabase Storage `creative-assets` 자동 저장
- `creative_jobs` 생성 이력, 성공·실패 상태와 결과 URL 기록
- Creative Studio Pro의 20~30초 장면 기획·렌더 파이프라인 기반
- Sprint 1~3 기능과 관리자 사이드바 통합

## 적용 순서

1. 기존 프로젝트를 별도 폴더에 백업합니다.
2. 이 ZIP의 폴더 내용을 기존 프로젝트에 모두 덮어씁니다.
3. Supabase SQL Editor에서 `supabase/SPRINT-4-CREATIVE-STUDIO.sql`을 실행합니다.
4. 기존 `.env.local`은 유지하고 아래 Sprint 4 값을 추가합니다.
5. PowerShell에서 아래 명령 4개를 순서대로 실행합니다.

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run build
npm run dev
```

## `.env.local`에 추가할 값

```env
OPENAI_IMAGE_MODEL=gpt-image-1
RUNWAYML_API_SECRET=
RUNWAY_VIDEO_MODEL=gen4.5
CREATIVE_STORAGE_BUCKET=creative-assets
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY`는 브라우저에 노출하면 안 됩니다. 반드시 `.env.local` 서버 환경변수에만 입력하세요.

## 사용 위치

- 기본 제작실: `http://localhost:3000/admin/creative-studio`
- 20~30초 장면 제작실: `http://localhost:3000/admin/creative-studio-pro`

## 연결 전에도 가능한 것

화면과 프롬프트 입력, 작업 구조, 이력 UI는 확인할 수 있습니다. 실제 이미지 생성에는 OpenAI API 결제 및 키가 필요하고, 실제 영상 생성에는 Runway 개발자 API 키와 사용 가능한 크레딧이 필요합니다.
