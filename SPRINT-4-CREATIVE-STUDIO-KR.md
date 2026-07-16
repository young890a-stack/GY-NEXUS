# Sprint 4 · Creative Studio 설치 안내

1. 기존 `.env.local`을 새 폴더에 복사합니다.
2. `.env.example`의 Sprint 4 항목을 `.env.local`에 추가합니다.
3. Supabase SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
4. Runway 개발자 포털에서 API Key와 크레딧을 준비하고 `RUNWAYML_API_SECRET`에 입력합니다.
5. `npm install` 후 `npm run dev`를 실행합니다.
6. `/admin/creative-studio`로 접속합니다.

## 실제 동작
- OpenAI 이미지 API로 PNG를 생성합니다.
- 생성 이미지를 Supabase Storage `creative-assets` 버킷에 저장합니다.
- Runway API로 5초 세로형 영상 또는 이미지→영상을 생성합니다.
- 완성 영상은 가능한 경우 Storage에 복사하고, 큰 파일이나 원격 저장 실패 시 Runway 제공 URL을 보존합니다.
- 모든 작업 상태와 결과 URL을 `creative_jobs` 테이블에 기록합니다.

## 비용 주의
이미지와 영상 생성은 외부 API 사용료가 발생합니다. 한 번 클릭할 때 한 작업만 요청하도록 구성했습니다.
