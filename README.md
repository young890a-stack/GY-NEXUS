# GY-NEXUS v3.0 ULTIMATE

AI 제휴마케팅 운영을 위한 실행형 Next.js 프로젝트입니다.

## 포함 기능
- AI 블로그, 15초 쇼츠, SEO·썸네일 프롬프트 패키지 생성
- 상품 등록·수정·삭제 및 CSV 일괄 자동 등록
- 제휴 링크 클릭 추적과 상품별 통계
- AI 콘텐츠 Supabase 저장 및 생성 이력
- 콘텐츠 예약 일정 관리
- Supabase 이메일·비밀번호 관리자 로그인
- 관리자 대시보드, 설정, 반응형 모바일 UI

## 설치
1. `1-처음설치.bat` 실행
2. `.env.example`을 `.env.local`로 복사하고 키 입력
3. Supabase SQL Editor에서 `supabase/schema.sql` 전체 실행
4. Supabase Authentication > Users에서 관리자 계정 생성
5. `2-서버실행.bat` 실행
6. `http://localhost:3000/login` 접속

## 환경변수
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
```

## 중요한 범위
예약 기능은 일정과 상태를 관리합니다. 네이버·유튜브·인스타그램에 자동 발행하려면 각 플랫폼의 공식 API 승인과 별도 자격 증명이 필요합니다. 상품 자동 등록은 안전한 CSV 일괄 등록 방식입니다.

## v5.2 외부 채널 연결

### YouTube
Google Cloud OAuth 웹 애플리케이션에 다음 URI를 등록합니다.

- `http://localhost:3000/api/connections/youtube/callback`

YouTube Data API v3를 활성화하고 `.env.local`에
`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `CONNECTION_ENCRYPTION_KEY`를 입력합니다.

### Naver
NAVER Developers 애플리케이션 Callback URL에 다음 URI를 등록합니다.

- `http://localhost:3000/api/connections/naver/callback`

`.env.local`에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 입력합니다.
현재 공개 API 기준으로 네이버 블로그 자동 글쓰기는 지원하지 않으며 로그인/프로필 확인과 수동 발행 흐름을 제공합니다.

### Coupang Partners
파트너스 포털에서 발급한 Access Key와 Secret Key를 등록한 뒤 외부 채널 화면에서 실시간 API 테스트를 실행합니다.

### Temu Affiliate
Temu에서 제공한 제휴 ID와 실제 제휴 링크 형식을 `TEMU_AFFILIATE_LINK_TEMPLATE`에 등록합니다.
템플릿에는 `{url}` 또는 `{product_url}` 자리표시자가 필요합니다.

## GY-NEXUS Ultimate v7.0 · Dream Y

v7.0은 기존 운영형 기반 위에 AI Company OS의 첫 실행 코어를 추가합니다.

- `/admin/strategy-room`: Dream Y AI 전략회의실
- `/admin/memory`: 회사 기억센터
- `/admin/evolution-room`: AI 진화회의

처음 적용할 때 Supabase SQL Editor에서 `supabase/schema.sql` 전체를 다시 실행하세요. `create table if not exists`와 `add column if not exists`를 사용하므로 기존 데이터는 유지됩니다.
