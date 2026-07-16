# GY-NEXUS Ultimate v7.0 · Sprint 2

## 추가 기능
- Product Intelligence Center
- 쿠팡·Temu 후보 JSON 일괄 입력
- GY Opportunity Score 계산
- S/A/B/C/D 등급 및 제작 우선순위
- 경쟁·정책·데이터 신뢰도 위험 평가
- 분석 결과를 기존 정식 상품·콘텐츠 제작 흐름으로 승격

## 설치
1. 기존 프로젝트를 백업합니다.
2. 이 ZIP을 새 폴더에 압축 해제합니다.
3. 기존 `.env.local`을 복사합니다.
4. Supabase SQL Editor에서 `supabase/schema.sql`을 실행합니다.
5. `npm install` 후 `npm run dev`를 실행합니다.
6. `/admin/product-intelligence`로 접속합니다.

## 데이터 원칙
이 Sprint는 무단 크롤링을 하지 않습니다. 쿠팡·Temu의 공식 API·승인된 제휴 피드·대표님이 직접 확보한 상품 링크를 입력받아 분석합니다.
