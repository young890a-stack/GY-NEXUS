# GY-NEXUS Ultimate v7.0 · Sprint 10 Final Operating Guide

## 핵심 화면
- `/admin/company-os` : 대표 상황실 및 운영 준비도
- `/admin/product-intelligence` : 상품 기회 분석
- `/admin/content-factory` : 콘텐츠 생산
- `/admin/creative-studio` : 이미지·영상 제작
- `/admin/automation` : 작업 큐와 원터치 실행
- `/admin/publishing` : 게시 대기열
- `/admin/growth` : Search Console·GA4 성장 분석

## 최초 적용
1. 기존 `.env.local`을 별도 보관합니다.
2. Sprint 10 파일을 기존 프로젝트에 덮어씁니다.
3. Supabase SQL Editor에서 `supabase/SPRINT-10-MIGRATION.sql`을 실행합니다.
4. `npm install` 후 `npm run build`로 품질을 확인합니다.
5. `npm run dev`를 실행하고 `/admin/company-os`에 접속합니다.

## 운영 안전 원칙
- Blogger는 처음에는 초안, YouTube는 비공개 업로드를 권장합니다.
- OpenAI·Runway·Supabase 서비스 키는 브라우저 코드에 넣지 않습니다.
- `.env.local`은 GitHub나 공유 ZIP에 포함하지 않습니다.
- 자동화 실패 작업은 원인을 확인한 후 재실행합니다.
- 일반 블로그 글은 Google Indexing API 자동 색인 대상이 아닙니다. 사이트맵과 Search Console을 사용합니다.

## 완료 기준
- AI Company OS에서 핵심 연결 상태가 표시됩니다.
- Dream Y 대표 브리핑이 생성됩니다.
- 상품 → 콘텐츠 → 크리에이티브 → 자동화 → 게시 → 성장 분석 메뉴가 연결됩니다.
- Search Console·GA4 OAuth와 Supabase 테이블이 정상 동작합니다.
