# GY-NEXUS 쇼핑 쇼츠 실제 짜집기 V2.5

## 이번에 바로잡은 핵심

V2.4의 검색 카드 선택은 영상 페이지의 썸네일과 메모로 컷 순서를 설계하는 기능이었습니다. 실제 MP4 파일이 없는 검색 링크까지 ‘자동 제작’처럼 표현돼, 타임라인은 보이지만 최종 짜집기는 실행되지 않는 문제가 있었습니다.

V2.5는 아래 차이를 화면과 실행 조건에서 명확히 분리합니다.

- 도우인·샤오홍슈 검색 카드: 인기 구조·훅·각도·판매 포인트 분석용
- 직접 촬영·판매자/제휴 제공·사용 허가 MP4/MOV: 실제 최종 컷 사용 가능
- 권리 미확인 검색 링크: 원본 다운로드·워터마크 제거 없이 새 장면 설계만 가능

## 실제 실행 보완

- 허가 영상 업로드 시 브라우저에서 길이와 핵심 프레임 5~6장을 자동 추출합니다.
- 별도 캡처 없이 추출 프레임이 AI 상품·장면 분석에 들어갑니다.
- 영상마다 실제 사용할 시작·끝 구간을 설정할 수 있습니다.
- AI가 같은 영상 첫 부분만 반복하지 않도록 컷별 원본 시작점을 다르게 배정합니다.
- 1.2x·1.4x 속도 적용 후에도 타임라인의 각 컷 길이가 줄어들지 않게 FFmpeg 필터를 수정했습니다.
- 세 가지 짜집기 방식을 분리했습니다.
  - `허가 영상만 빠르게 짜집기`: Runway 없이 실제 파일만으로 완성
  - `허가 영상＋새 AI 장면`: 원본 컷과 Runway 장면을 혼합
  - `검색 구조만 참고해 새로 제작`: 검색 영상은 분석만 하고 전체를 새로 제작
- 허가 영상만으로 모든 컷이 채워지면 불필요한 이미지·Runway 전체 완료 조건을 강제하지 않습니다.
- 실제 실행 전 파일·권리·훅 승인·음성·Runway 장면·Worker 연결을 한 번에 검사합니다.
- `Queued` 이후 4초마다 대기열 → 합성 중 → 완료/실패 상태를 자동 갱신합니다.
- 실패 시 ‘다운로드·컷 생성·타임라인 연결·자막/음성·업로드’ 중 어느 단계에서 실패했는지 표시합니다.
- 진행 중인 작업을 중복 실행하지 못하게 차단합니다.

## 가장 빠른 실제 사용 순서

1. `/admin/shopping-shorts`에서 프로젝트를 엽니다.
2. 한국어 상품명을 입력해 도우인·샤오홍슈 인기/관련 쇼츠를 찾습니다.
3. 검색 영상을 재생하고 참고할 카드를 선택해 `구조 분석·한국형 제작 준비`를 누릅니다.
4. 실제 최종본에 쓸 수 있는 직접 촬영·판매자/제휴 제공·사용 허가 MP4/MOV를 `사용 허가 영상 파일`에 올립니다.
5. 권리 상태를 선택하고 `업로드 허가 영상을 최종본에 사용`을 체크합니다.
6. 자동 추출된 핵심 프레임을 확인하고 `소재 추가`를 누릅니다.
7. 짜집기 방식을 `허가 영상만 빠르게 짜집기`로 선택합니다.
8. 중국어 화면 자막은 `허가 영상 하단 안전 크롭` 또는 `원문 유지`를 선택합니다.
9. `선택 소스로 AI 짜집기 설계`를 다시 누릅니다.
10. 한국어 훅 3개 중 하나를 고르고 `선택한 훅으로 승인`을 누릅니다.
11. REAL MIX PREFLIGHT에서 부족 항목이 없는지 확인합니다.
12. `실제 짜집기 지금 실행`을 누릅니다. 한국어 TTS가 없으면 승인된 대본으로 자동 생성합니다.

## 새 AI 장면을 섞는 경우

`허가 영상＋새 AI 장면` 또는 `검색 구조만 참고해 새로 제작`에서는 REAL MIX PREFLIGHT가 다음 순서를 안내합니다.

1. 전체 이미지 검수
2. 대표 Runway 비용 승인
3. 남은 영상 모두 생성
4. 실제 짜집기 실행

검색 링크만 선택하고 허가 영상 파일을 올리지 않은 경우 실제 원본 짜집기는 할 수 없습니다. 이 경우에는 새 AI 장면 제작 방식이 정상 흐름입니다.

## FFmpeg Worker 연결은 필수

Vercel은 사이트 화면과 API를 배포하지만, 장시간 FFmpeg 합성 Worker를 자동으로 실행하지 않습니다. 루트의 `render.yaml`로 Docker Worker를 별도 Web Service에 배포해야 합니다.

Worker 환경변수:

- `VIDEO_WORKER_SECRET`: Vercel과 완전히 동일한 긴 임의 값
- `GY_APP_ORIGIN`: `https://gy-nexus-zfpq.vercel.app`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CREATIVE_STORAGE_BUCKET=creative-assets`

Worker 배포 후:

1. `https://Worker주소/health`에서 `ok: true` 확인
2. Vercel Production 환경변수에 `VIDEO_WORKER_URL=https://Worker주소` 입력
3. Vercel과 Worker에 동일한 `VIDEO_WORKER_SECRET` 입력
4. Vercel Production 재배포

공식 참고:

- https://render.com/docs/docker
- https://render.com/docs/web-services
- https://render.com/docs/blueprint-spec#setting-environment-variables

## 검증

- TypeScript: 통과
- ESLint: 오류 0개, 기존 경고 7개
- Next.js Production Build: 통과
- FFmpeg 1.4x 컷 길이 실합성: 입력 2.8초 → 출력 정확히 2.0초
- Worker JavaScript 문법: 통과
- 신규 API: `/api/creative-studio-pro/projects/[id]/mix-readiness`
- Render Docker Blueprint: 포함
