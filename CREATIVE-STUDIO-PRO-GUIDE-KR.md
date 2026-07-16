# Creative Studio Pro · 20~30초 멀티샷 영상 제작센터

## 포함 기능
- 20초 / 25초 / 30초 길이 선택
- 9:16 / 16:9 / 1:1 비율
- 영화형 광고, 감성 브랜드, 사용법, UGC 후기, 문제 해결형 스타일
- 정확한 한국어 자막 또는 자막 없음
- 여성/남성 내레이션, 음악만, 무음 설정 저장
- 5초 단위 자동 장면 기획
- Runway 장면별 생성 및 실패 장면만 재시도
- Supabase 프로젝트·장면·렌더 작업 저장
- 외부 FFmpeg Worker 연결용 렌더 API와 콜백

## 설치
1. `supabase/CREATIVE-STUDIO-PRO-MIGRATION.sql`을 Supabase SQL Editor에서 실행합니다.
2. `npm install` 후 `npm run dev`를 실행합니다.
3. `/admin/creative-studio-pro`에 접속합니다.

## 최종 MP4 합성
장면 생성은 GY-NEXUS 서버에서 수행합니다. 장면 연결, SRT 자막, TTS 음성, 배경음악 믹싱은 FFmpeg가 설치된 장시간 실행 Worker가 필요합니다.

환경변수:
```
VIDEO_WORKER_URL=https://your-video-worker.example.com
VIDEO_WORKER_SECRET=긴_비밀문자열
```

Worker가 없더라도 장면 기획과 장면별 Runway 영상 생성은 사용할 수 있습니다. `최종 MP4 합성` 버튼은 Worker 연결 필요 안내를 표시합니다.
