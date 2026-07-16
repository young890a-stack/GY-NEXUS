# Sprint 5 · One-Click Publisher

## 핵심 기능
- 저장된 AI 콘텐츠를 불러와 게시 제목과 본문 자동 채움
- Blogger 공식 API 게시 또는 초안 저장
- WordPress REST API 게시
- Make·Zapier·n8n 웹훅 전송
- 예약 게시 대기함, 실행, 재시도, 취소, 삭제
- 실패 원인과 게시 결과 URL 기록
- 최대 재시도 횟수 보호

## 적용 방법
1. 기존 `.env.local`은 그대로 보존합니다.
2. 이 ZIP을 기존 Sprint 4 폴더에 전체 덮어씁니다.
3. `.env.example`의 Sprint 5 항목 중 필요한 채널만 `.env.local`에 추가합니다.
4. `npm install` 후 `npm run dev`를 실행합니다.
5. `/admin/publishing`에서 게시 작업을 등록합니다.

## Blogger
외부 채널 연결센터에서 Blogger OAuth를 연결합니다. `BLOGGER_BLOG_ID`가 비어 있으면 연결된 계정의 첫 번째 블로그를 자동 선택합니다.

## 네이버 블로그
네이버는 공식 블로그 글쓰기 API를 제공하지 않으므로 자동 게시를 주장하지 않습니다. Content Factory에서 생성한 글을 복사하여 수동 발행하는 안전한 흐름을 유지합니다.

## YouTube
영상 파일 업로드는 기존 `/admin/youtube` 공식 업로더를 사용합니다. 원격 영상 URL 자동 다운로드·게시 기능은 다음 자동화 Sprint에서 작업합니다.
