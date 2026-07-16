# GY-NEXUS Sprint 8 · SEO Studio 통합본

## 포함 기능
- AI SEO 분석 및 7개 점수
- 메타 제목·설명, 키워드, 목차, FAQ, ALT, 내부 링크 제안
- 썸네일 A/B/C 기획과 예상 CTR 점수
- 15~30초 쇼츠 제목·훅·대본·CTA·해시태그 최적화
- SEO 보고서 Supabase 저장
- Google Search Console OAuth 연결·해제
- 인증된 Search Console 속성 목록 조회
- 최근 28일 검색어·페이지별 클릭·노출·CTR·평균순위 조회

## 반드시 실행
Supabase SQL Editor에서 `supabase/SPRINT-8-MIGRATION.sql`을 실행합니다.

## Google Cloud 설정
1. Search Console API 사용 설정
2. 기존 GY-NEXUS Web Client의 승인된 리디렉션 URI에 아래를 추가
   - 로컬: `http://localhost:3000/api/search-console/callback`
   - 배포: `https://내도메인/api/search-console/callback`
3. `.env.local`은 기존 BLOGGER_CLIENT_ID/SECRET을 재사용할 수 있습니다.
4. 별도로 분리하려면 SEARCH_CONSOLE_CLIENT_ID/SECRET을 입력합니다.

## 접속
`http://localhost:3000/admin/seo-studio`

## 보안
OAuth 토큰은 암호화된 HttpOnly 쿠키로 저장됩니다. `CONNECTION_ENCRYPTION_KEY`가 반드시 필요합니다.
