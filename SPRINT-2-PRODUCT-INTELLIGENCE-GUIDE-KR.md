# GY-NEXUS AI Company OS v2.0 · Sprint 2

## 이번 ZIP에 실제 추가·정리된 기능

1. `/admin/product-intelligence` 상품 기회 대시보드
2. 승인된 제휴 피드·직접 확보 링크용 JSON 일괄 수집
3. 수요·계절성·가격·영상 적합성·타깃·수익성·경쟁·정책 위험 기반 Opportunity Score
4. S/A/B/C/D 등급, 추천 이유, 위험요소, 쇼츠 훅 자동 생성
5. 승인 대기·승인·보류·제외 필터
6. 상품별 승인·보류·제외 처리
7. 승인 시 `products` 테이블에 중복 없이 정식 등록
8. 75점 이상 TOP10 일괄 승인
9. 모든 수집·승인 이력을 `product_intelligence_runs`에 기록
10. Sprint 7/v7 혼재 표기를 v2.0 Sprint 2 기준으로 정리

## 중요한 범위

- 쿠팡·Temu 웹페이지 무단 크롤링은 포함하지 않습니다.
- 공식 API, 승인된 데이터 피드, CSV/JSON 내보내기, 대표님이 확보한 제휴 링크를 입력하는 합법적 구조입니다.
- 실제 외부 API 자동 수집은 해당 플랫폼에서 발급받은 공식 권한과 키가 있을 때 어댑터로 연결합니다.

## 설치

1. 기존 프로젝트 파일을 이 ZIP의 파일로 교체합니다.
2. `.env.local`은 기존 값을 유지합니다.
3. Supabase SQL Editor에서 `supabase/SPRINT-2-PRODUCT-INTELLIGENCE.sql`을 실행합니다.
4. PowerShell에서 아래 순서로 실행합니다.

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run build
npm run dev
```

5. 브라우저에서 `/admin/product-intelligence`를 엽니다.
