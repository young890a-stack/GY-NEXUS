# GY Production Deployment

권장 구조:

- Vercel: Next.js 웹 및 API
- Supabase: Auth, PostgreSQL, Storage
- Railway/Render: FFmpeg 영상 Worker
- `www.gywealthlab.com`: Blogger
- `app.gywealthlab.com`: GY Company OS

배포 순서:

1. GitHub Private 저장소로 이전
2. Vercel 프로젝트 생성
3. `.env.local` 값을 Vercel Environment Variables에 등록
4. `app.gywealthlab.com` 도메인 연결
5. Google OAuth Redirect URI에 `https://app.gywealthlab.com/api/search-console/callback` 추가
6. Supabase Auth Site URL과 Redirect URL을 배포 주소로 변경
7. 빌드·로그인·DB·AI 생성·모바일·OAuth를 점검
