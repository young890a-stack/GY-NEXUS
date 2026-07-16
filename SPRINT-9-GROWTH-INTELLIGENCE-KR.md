# GY-NEXUS Sprint 9 · Growth Intelligence

## 핵심 기능
- Search Console + GA4 통합 성장 대시보드
- 검색 클릭·노출·CTR·평균 순위
- GA4 활성 사용자·세션·조회수·참여율
- 상위 검색어·상위 방문 페이지·유입 채널
- Dream Y AI 성장 보고서
- Google OAuth 재연결 및 권한 점검 안내

## 필요한 환경변수
```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SEARCH_CONSOLE_SITE_URL=https://gywealthlab.blogspot.com/
GA4_PROPERTY_ID=543105479
GA4_MEASUREMENT_ID=G-MSD45HMDJZ
CONNECTION_ENCRYPTION_KEY=32자_이상의_임의_문자열
```

기존 SEARCH_CONSOLE_CLIENT_ID/SECRET도 계속 지원합니다.

## OAuth Redirect URI
```text
http://localhost:3000/api/search-console/callback
```

## 실행
1. `supabase/SPRINT-9-MIGRATION.sql` 실행
2. `npm install`
3. `npm run dev`
4. `http://localhost:3000/admin/growth`
5. Google 통합 연결 시작
