# GY-NEXUS Video Worker

쇼핑 쇼츠 센터의 최종 MP4를 만드는 독립 FFmpeg Worker입니다.

- AI/허가 영상 컷을 9:16 또는 16:9 규격으로 정규화
- AI 분석의 믹스 순서와 0.7~2.5초 컷 길이 반영
- 한국어 ASS 자막 번인
- 승인된 AI 음성과 선택 BGM 믹싱
- Supabase Storage 업로드 후 GY-NEXUS에 완료 콜백
- 권리 미확인 소재는 Worker 입력 전에 사이트에서 차단되며 Worker도 다시 제외
- 허가 영상별 시작·끝 범위 안에서 서로 다른 컷 구간을 선택해 첫 장면 반복 방지
- 1.0x/1.2x/1.4x 속도 적용 후에도 각 타임라인 컷 길이를 정확히 유지
- 대기열 → 합성 중 → 완료/실패 상태와 실패 단계를 GY-NEXUS로 콜백

Docker 서비스로 배포한 뒤 GY-NEXUS에 다음 값을 설정합니다.

```text
VIDEO_WORKER_URL=https://배포한-worker-주소
VIDEO_WORKER_SECRET=두-서비스에-같은-긴-비밀값
```

Worker에는 `.env.example`의 Supabase 값과 `GY_APP_ORIGIN`도 설정해야 합니다. BGM 주소는 본인이 사용권을 보유한 직접 파일 주소만 넣습니다. 주소가 없으면 음성만 합성합니다.

## Render Docker 배포

루트의 `render.yaml`은 이 Worker만 Docker Web Service로 배포합니다. Render에서 GY-NEXUS GitHub 저장소를 Blueprint로 연결한 뒤, 처음 생성할 때 다음 값을 입력합니다.

- `VIDEO_WORKER_SECRET`: 길고 임의적인 값. Vercel에도 완전히 같은 값을 입력
- `GY_APP_ORIGIN`: `https://gy-nexus-zfpq.vercel.app`
- `SUPABASE_URL`: Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: 서버 전용 Service Role Key
- `CREATIVE_STORAGE_BUCKET`: 기본 `creative-assets`

배포 후 `https://생성주소.onrender.com/health`가 `ok: true`를 반환하는지 확인합니다. 그 주소를 Vercel의 `VIDEO_WORKER_URL`에 입력하고 Production 재배포합니다.

- Render Docker: https://render.com/docs/docker
- Render Web Service: https://render.com/docs/web-services
- Blueprint 환경변수: https://render.com/docs/blueprint-spec#setting-environment-variables
