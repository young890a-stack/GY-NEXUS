# GY-NEXUS Sprint 4 Creative Studio Hotfix

## 수정 내용

1. Runway `promptImage: undefined` 오류 수정
   - 첫 장면 이미지 URL이 있으면 `imageToVideo`
   - 비어 있으면 `textToVideo`
   - 잘못된 URL과 HTTP URL은 친절한 오류 메시지로 차단

2. Supabase Storage `Invalid key` 오류 수정
   - 한글 작업명과 특수문자를 Storage 경로에 직접 넣지 않음
   - 이미지와 영상 파일명을 ASCII 영문·숫자·하이픈 기반으로 자동 생성
   - 파일 경로 생성을 공통 함수로 통합

3. 입력값 안정화
   - 제목, 프롬프트, 첫 장면 URL의 앞뒤 공백 자동 제거
   - 이미지 다운로드 및 Storage 공개 URL 오류 메시지 강화

## 설치 및 실행

기존 프로젝트 폴더에 전체 덮어쓰기한 뒤 다음을 실행합니다.

```powershell
npm install
npm run dev
```

`.env.local`은 ZIP에 포함되지 않습니다. 기존 파일을 그대로 유지해야 합니다.
