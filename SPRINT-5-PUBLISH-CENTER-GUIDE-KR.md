# Sprint 5 · Publish Center 설치 안내

## 1. 적용
이 ZIP은 Sprint 1~4를 포함한 전체 교체본입니다. 기존 프로젝트를 백업한 뒤 압축을 풀고 전체 파일을 덮어씁니다.

## 2. Supabase
Supabase SQL Editor에서 `supabase/SPRINT-5-PUBLISH-CENTER.sql`을 실행합니다.

## 3. 환경변수
기존 `.env.local`을 유지하고 `.env.example`의 Sprint 5 항목을 참고합니다.

필수 연결:
- YouTube: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`
- Blogger: YouTube와 같은 Google OAuth 앱을 재사용하거나 `BLOGGER_CLIENT_ID`, `BLOGGER_CLIENT_SECRET` 사용
- Supabase: 기존 URL·Anon Key·Service Role Key

## 4. 실행
```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run build
npm run dev
```

## 5. 접속
- Publish Center: `http://localhost:3000/admin/publishing`
- Connection Center: `http://localhost:3000/admin/connections`

## 실제 동작 범위
- YouTube: OAuth 연결 후 영상 URL을 읽어 영상, 메타데이터, 태그, 썸네일 업로드
- Blogger: OAuth 연결 후 HTML 본문, 라벨, 초안 또는 공개 게시
- 네이버 블로그: 게시 패키지 생성, 본문 복사, 네이버 공유창 연결. 공식 원격 글쓰기 API가 아니므로 최종 발행 확인 필요

## 예약 실행
현재 예약 시간이 지난 작업은 Publish Center의 `예약 작업 지금 실행` 버튼으로 처리합니다. 서버 배포 후에는 `/api/publish/run`을 Vercel Cron 또는 외부 Cron에서 호출해 무인 실행할 수 있습니다.
