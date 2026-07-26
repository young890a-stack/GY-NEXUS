# GY-NEXUS 한국형 자동 쇼핑 쇼츠 제작기 빌드 검증

검증일: 2026-07-26  
기준 원격 커밋: `249e40c6d0f0ca23d4662d75c772ff1a4fae6880`  
대상 Vercel 프로젝트: `gy-nexus-zfpq`
운영 도메인: `https://gynexus.com`

## 구현 결과

- 상품 URL 또는 직접 상품정보 1회 입력
- 상품 메타데이터·JSON-LD 후기·이미지 분석
- 한국형 판매 포인트와 훅 3개 생성
- 훅 3개 × 15초·20초·30초 = 9개 버전 생성
- 장면표, 한국어 대본, 정확한 타임라인 자막, SRT 생성
- 제목, 설명, 해시태그, 썸네일 카피 생성
- 8개 품질항목 이중검사
- 기준 미달 최대 2회 자동 재생성
- 미달 버전 MP4 제작 차단
- 합격 버전 기존 AI 음성·Render·FFmpeg 9:16 자동 제작 연결
- 최종 공개 전 기존 비공개 검수·대표 승인 유지
- 영상별 성과 저장과 우수 패턴 재사용
- 순이익과 무재고 커머스 후보 판정

## 검증 결과

| 검사 | 결과 | 비고 |
|---|---|---|
| TypeScript 전체 검사 | 통과 | `tsc --noEmit` |
| Next.js 프로덕션 빌드 | 통과 | 118개 페이지 생성, 신규 관리자 페이지와 4개 API 경로 포함 |
| 신규/수정 기능 린트 | 통과 | 쇼츠 제작기 API·UI·라이브러리 및 연결 페이지 |
| 환경변수 검사 | 통과 | 핵심 키 준비 상태 확인 |
| 영상 워커 JavaScript 문법 | 통과 | `video-worker/server.mjs` |
| FFmpeg 운영 호환 | 확인 | Render Dockerfile이 `ffmpeg`, `fonts-noto-cjk` 설치 |
| 전체 저장소 린트 | 기존 오류 | 이번 변경 밖의 기존 v3 모듈에 `no-explicit-any` 34개가 있어 전체 명령은 실패함 |
| 실제 유료 AI/Render 호출 | 미실행 | 비용 발생과 운영 데이터 변경을 피하기 위해 배포 후 관리자 점검으로 남김 |

## 신규 운영 경로

- 관리자 화면: `/admin/auto-shopping-shorts`
- 실행 생성/목록: `/api/shopping-shorts/runs`
- 실행 결과: `/api/shopping-shorts/runs/[id]`
- 성과 저장/학습: `/api/shopping-shorts/runs/[id]/performance`
- 기존 자동 영상 제작 연결: `/api/shopping-shorts/runs/[id]/variants/[variantId]/production`

## 배포 전 필수 작업

1. `supabase/migrations/20260726_korean_auto_shopping_shorts.sql` 실행
2. Vercel 환경변수 확인
   - `NEXT_PUBLIC_SITE_URL=https://gynexus.com`
   - OAuth 리디렉션 URI도 `https://gynexus.com` 기준
3. Render 워커 환경변수와 `/health` 확인
   - `GY_APP_ORIGIN=https://gynexus.com`
4. Preview 배포에서 상품 1개로 9개 버전 생성 확인
5. 합격 버전 하나만 MP4로 제작하고 자막·음성·9:16 출력 확인
6. 확인 후 Production 배포

## 이번 산출물에서 제외한 것

- 비밀값이 든 `.env.local`
- `node_modules`
- `.next` 빌드 캐시
- 기존 임시 백업 폴더와 이전 ZIP
