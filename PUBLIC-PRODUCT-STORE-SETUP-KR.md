# GY-NEXUS 공개 상품관 V1 적용 순서

## 이번 패치가 보완하는 것
- 로그인 없이 누구나 보는 공개 추천상품 목록
- `/products/[slug]` 상품별 상세페이지
- `/go/[slug]` 개인정보 최소화 클릭 출처 기록
- 대표 승인 상품만 공개
- 품질점수, 링크 상태, 품절·오류 차단
- 쇼츠·상세 영상·블로그 리뷰 연결
- 카테고리와 검색
- 검색엔진용 sitemap/robots/메타데이터
- 방문자의 상품 직접 수정이 가능했던 기존 공개 RLS 정책 제거

## 적용 순서
1. Supabase SQL Editor에서 `supabase/migrations/20260721_public_product_store.sql` 전체 실행
2. 패치 폴더를 GY-NEXUS 프로젝트 최상위에 덮어쓰기
3. PowerShell에서 실행

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run typecheck
npm run build
git add .
git commit -m "Add secure public affiliate product store"
git push
```

## 공개 규칙
- `status = published`
- `is_public = true`
- 링크 상태가 `broken` 또는 `sold_out`이 아님

세 조건을 통과해야 공개 상품관과 제휴 이동이 작동합니다.

## 다음 개발 단계
다음은 회원 등급과 결제를 붙이는 `Member Access & Billing` 단계입니다.
- guest / free / plus / pro / owner 역할
- 회원별 사용량
- 구독 상태 서버 검증
- 회원 전용 쇼츠 제작실
- 대표 운영실 회원·결제 관리
