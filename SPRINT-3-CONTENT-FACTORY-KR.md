# GY-NEXUS Ultimate v7.0 — Sprint 3 Content Factory

## 이번 버전의 핵심
상품 하나를 선택하면 다음 결과를 한 번에 생성합니다.

- 1,800~2,500자 SEO 블로그 완성본
- 15~30초 쇼츠 제목·훅·음성 대본·장면표
- 썸네일 문구와 이미지 생성 프롬프트
- 블로그 삽입 이미지 프롬프트 3종
- 9:16 영상 제작 통합 프롬프트
- 정확한 한국어 SRT와 다운로드 파일
- 제휴 고지·금지 표현·최종 품질 체크리스트
- Supabase 생성 이력 저장

## 적용 순서
1. 기존 프로젝트 폴더를 백업합니다.
2. 이 ZIP을 새 폴더에 압축 해제합니다.
3. 기존 `.env.local`을 새 폴더로 복사합니다.
4. `supabase/schema.sql` 전체를 Supabase SQL Editor에서 실행합니다.
5. 터미널에서 `npm install` 후 `npm run dev`를 실행합니다.
6. `/admin/content-factory`에 접속합니다.

## 중요
이 Sprint는 이미지·영상의 제작 지시서와 정확한 자막 패키지를 실제 생성합니다. 이미지 파일과 MP4 영상 자체를 자동 렌더링하는 기능은 Sprint 4 Creative Studio에서 외부 생성 API와 저장소를 연결해 추가합니다.
