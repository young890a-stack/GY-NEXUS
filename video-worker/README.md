# GY-NEXUS Video Worker

쇼핑 쇼츠 센터의 최종 MP4를 만드는 독립 FFmpeg Worker입니다.

- AI/허가 영상 컷을 9:16 또는 16:9 규격으로 정규화
- AI 분석의 믹스 순서와 0.7~2.5초 컷 길이 반영
- 한국어 ASS 자막 번인
- 승인된 AI 음성과 선택 BGM 믹싱
- Supabase Storage 업로드 후 GY-NEXUS에 완료 콜백
- 권리 미확인 소재는 Worker 입력 전에 사이트에서 차단되며 Worker도 다시 제외

Docker 서비스로 배포한 뒤 GY-NEXUS에 다음 값을 설정합니다.

```text
VIDEO_WORKER_URL=https://배포한-worker-주소
VIDEO_WORKER_SECRET=두-서비스에-같은-긴-비밀값
```

Worker에는 `.env.example`의 Supabase 값과 `GY_APP_ORIGIN`도 설정해야 합니다. BGM 주소는 본인이 사용권을 보유한 직접 파일 주소만 넣습니다. 주소가 없으면 음성만 합성합니다.
