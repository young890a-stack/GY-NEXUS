# GY First Release Production 1.0

**Company:** GY Labs  
**Platform:** GY-NEXUS  
**Operating System:** GY Company OS  
**AI:** Dream Y  
**Tagline:** One Human. One AI Company.

## 포함 범위

- 대표 상황실과 기존 Sprint 1~11.5 운영 기능
- Product Intelligence, Universal Import, Product DNA
- Creative Studio와 20·25·30초 Creative Studio Pro
- Blogger·YouTube·Search Console·GA4 연결 구조
- Google/Naver 승인용 및 SEO 성장 게시 전략센터
- 90점 게시 기준의 GY Quality Engine
- 회원가입·로그인·회원 페이지·방문자 Discover 화면
- 고객 프로필·북마크·댓글·문의 기반 데이터 구조
- GY Brand Center
- 모바일 반응형과 PWA manifest

## 설치

1. 기존 `.env.local` 백업
2. 이 프로젝트를 기존 폴더에 전체 교체
3. 이전 Sprint SQL이 누락되었다면 순서대로 실행
4. `supabase/GY-FIRST-RELEASE-PRODUCTION-1.0.sql` 실행
5. `npm install`
6. `npm run build`
7. `npm run dev`

## 실운영 전 필수

- Supabase Auth 이메일 설정 및 관리자 계정 생성
- Vercel 환경변수 등록
- Google OAuth 배포 Callback 추가
- `app.gywealthlab.com` 연결
- Runway API 크레딧 및 영상 Worker 연결
- 회원 약관·개인정보처리방침·광고 고지 작성
- 관리자 권한을 DB 역할로 제한하는 추가 정책 검증

## 주요 주소

- 대표 상황실: `/admin`
- 품질 검수센터: `/admin/quality-center`
- 게시 전략센터: `/admin/publishing-strategy`
- GY Brand Center: `/admin/brand-center`
- 고객 콘텐츠: `/discover`
- 회원가입: `/signup`
- 회원 페이지: `/member`
