# Sprint 11.5 · Dream Y Universal Product Import Engine

## 목표
제휴링크 또는 상품 URL 하나를 입력하면 플랫폼을 감지하고, 허용된 공개 메타데이터를 읽습니다. 쿠팡 등에서 HTTP 403이 발생하더라도 오류로 중단하지 않고 직접 입력 모드로 전환합니다.

## 지원 플랫폼
- 쿠팡
- Temu
- 네이버 스마트스토어
- 11번가
- AliExpress
- Amazon
- 일반 쇼핑몰

## 안전 기준
- 접근 제한, 로그인, 봇 방지 장치를 우회하지 않습니다.
- 공식 API, 승인된 피드, 공개 메타데이터를 우선합니다.
- 추출 실패 시 제휴링크를 보존하고 상품명·설명·이미지·가격을 직접 입력합니다.
- 확인되지 않은 가격, 할인율, 효능, 인증, 후기, 순위를 생성하지 않습니다.
- 원본 이미지는 상품 확인 참고용이며 새 광고 이미지는 배경·구도·문구를 새롭게 생성합니다.

## 적용
1. 기존 `.env.local` 보관
2. 프로젝트 전체 덮어쓰기
3. Supabase에서 `supabase/SPRINT-11.5-UNIVERSAL-IMPORT-MIGRATION.sql` 실행
4. `npm install`
5. `npm run build`
6. `npm run dev`
7. `http://localhost:3000/admin/product-dna` 접속

## HTTP 403 처리
기존 버전은 403을 오류로 종료했지만, Sprint 11.5는 다음처럼 처리합니다.

- 플랫폼 자동 감지
- 원본 제휴링크 보존
- 직접 입력 폼 표시
- 원본 페이지 새 탭 열기 제공
- 상품명/설명/이미지 입력 후 Product DNA 캠페인 계속 생성
