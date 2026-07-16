# Sprint 7 — Product Intelligence Engine

## 포함 기능
- 상품 기회 대시보드와 TOP 순위
- 승인된 제휴 피드·직접 확보 링크의 일괄 수집
- 수요·계절성·가격 매력·쇼츠 적합도·타깃 적합도·수익성·경쟁·정책 위험 점수화
- S/A/B/C/D 등급과 제작 권고
- 75점 이상 TOP10 정식 상품 일괄 등록
- 콘텐츠 공장으로 바로 이동
- 실행 이력, 트렌드 키워드, 상품 점수, 경쟁 분석용 DB 기반

## 중요한 운영 원칙
쿠팡·Temu 웹페이지를 무단으로 실시간 크롤링한다고 가장하지 않습니다. 공식 API, 승인된 제휴 피드, 대표님이 확보한 상품 링크 또는 수동 데이터를 사용합니다.

## 설치
1. 기존 `.env.local` 보관
2. 전체 파일 덮어쓰기
3. `supabase/SPRINT-7-MIGRATION.sql` 실행
4. `npm install`
5. `npm run dev`
6. `/admin/product-intelligence` 접속
