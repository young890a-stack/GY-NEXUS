# GY-NEXUS AI Company OS v2.0

**첫 번째 공식 운영 버전**을 위한 Next.js 기반 AI 제휴마케팅 Company OS입니다. 테스트용 화면 모음이 아니라, 상품 기회 탐색부터 콘텐츠 제작·검수·게시·성과 학습까지 하나의 운영 파이프라인으로 이어지는 구조를 목표로 합니다.

## 운영 파이프라인

1. Product Intelligence — 쿠팡·Temu 상품 후보 수집과 기회 점수화
2. AI Decision — 추천 근거와 우선순위 제시
3. Content Factory — 쇼핑 쇼츠·블로그·SEO·CTA 패키지 생성
4. Creative Studio — 이미지·세로 영상 제작
5. Quality Center — 게시 전 품질 검사
6. Publishing Center — 채널별 게시·예약 작업 관리
7. Growth & Revenue — 클릭·검색·성과 분석
8. Learning & Executive AI — 운영 기록을 다음 추천에 반영

## 현재 시작 채널

- 판매·제휴: Coupang, Temu
- 콘텐츠·배포: Google Blogger, Naver, YouTube, Instagram
- 확장 예정: Naver Shopping, AliExpress, Amazon, TikTok 등

새 플랫폼은 핵심 코드를 다시 만들지 않고 Connector 모듈로 추가하는 것을 원칙으로 합니다.

## Windows 시작

1. `1-처음설치.bat`
2. `.env.local`에 연결 키 입력
3. Supabase SQL Editor에서 `supabase/schema.sql` 실행
4. `2-서버실행.bat`
5. `http://localhost:3000/admin/company-os-v2` 접속

GitHub에 올리기 전에는 `3-운영검증.bat`을 실행합니다.

## 명령어

```bash
npm ci
npm run dev
npm run check
```

## GitHub 운영 원칙

- `main`: 검증을 통과한 운영 버전
- `develop`: 다음 v2.x 통합 개발
- `feature/*`: 커넥터·엔진 단위 작업
- Pull Request마다 GitHub Actions가 lint와 production build를 검증
- `.env.local`과 비밀키는 절대 커밋하지 않음

## 중요한 현실적 범위

외부 플랫폼의 자동 게시·상품 수집 범위는 각 서비스의 공식 API, 계정 권한, 제휴 자격 및 승인 상태에 따라 달라집니다. API가 허용하지 않는 기능은 수동 승인·내보내기 흐름으로 안전하게 대체합니다.

자세한 장기 구조는 `docs/GY-NEXUS-V2-MASTER-BLUEPRINT.md`를 참고하세요.
