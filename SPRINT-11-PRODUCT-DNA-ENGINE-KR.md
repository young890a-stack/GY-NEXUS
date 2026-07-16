# GY-NEXUS Sprint 11 · Dream Y Product DNA Engine

## 목적
제휴링크 하나에서 공개된 상품 메타데이터를 확인하고, 원본 광고를 복제하지 않는 신규 콘셉트로 이미지·블로그·썸네일 문구·쇼츠 기획을 생성합니다.

## 적용
1. 기존 `.env.local` 보관
2. 전체 파일 덮어쓰기
3. Supabase SQL Editor에서 `supabase/SPRINT-11-PRODUCT-DNA-MIGRATION.sql` 실행
4. `npm install`
5. `npm run build`
6. `npm run dev`
7. `/admin/product-dna` 접속

## 이용 흐름
1. 제휴링크 입력
2. 자동 추출된 상품명·설명·이미지 확인 및 수정
3. 20·25·30초와 캠페인 스타일 선택
4. Product DNA 캠페인 생성
5. 신규 광고 이미지와 블로그·쇼츠 패키지 확인
6. Creative Studio Pro에서 장면별 영상을 생성하고 최종 MP4 합성

## 안전한 재창작 기본값
- 원본 사진의 배경·인물·구도·문구·로고·캐릭터를 복제하지 않습니다.
- 상품 페이지 정보는 제품 확인과 사실 기반 요약에만 사용합니다.
- 가격·할인율·성능·인증·리뷰·순위가 확인되지 않으면 생성하지 않습니다.
- 특정 브랜드가 허용한 공식 상품 이미지를 직접 사용할 때에는 별도의 이용 권한을 확인해야 합니다.
- 자동 추출 실패 시 수동 입력으로 계속 진행할 수 있습니다.

## 필요한 기존 환경변수
```env
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-1
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CREATIVE_STORAGE_BUCKET=creative-assets
RUNWAYML_API_SECRET=
RUNWAY_VIDEO_MODEL=gen4.5
```
