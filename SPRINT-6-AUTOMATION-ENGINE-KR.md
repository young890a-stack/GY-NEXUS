# GY-NEXUS Sprint 6 · Automation Engine

## 이번 Sprint 핵심

1. Automation Engine
   - 상품 선택 또는 AI 자동 선택
   - OpenAI 전체 콘텐츠 패키지 생성
   - OpenAI 세로형 광고 이미지 생성
   - Runway 5초 세로 영상 생성
   - Blogger 초안/게시
   - WordPress 및 웹훅 게시
   - YouTube Shorts 비공개/일부 공개/공개 업로드

2. Job Queue
   - queued / processing / retry / completed / failed / cancelled
   - 최대 3회 재시도
   - 이전에 성공한 콘텐츠·이미지·영상은 재사용하여 비용 중복 방지

3. 자동 실행 로그
   - 상품, 콘텐츠, 이미지, 영상, Blogger, YouTube 단계별 기록
   - 실패 단계와 오류 메시지 확인

## 반드시 먼저 할 일

Supabase Dashboard > SQL Editor에서 아래 파일을 전체 실행합니다.

`supabase/SPRINT-6-MIGRATION.sql`

## 실행

```powershell
npm install
npm run dev
```

접속 주소:

`http://localhost:3000/admin/automation`

## 안전 기본값

- Blogger: 초안 저장
- YouTube: 비공개 업로드
- Runway 영상 생성: API 크레딧이 있을 때만 체크
- 공개 게시 전에 대표 검토 권장

## 주의

이 버전의 작업 큐는 관리자 화면의 `지금 전체 실행` 또는 `대기 작업 실행` 버튼으로 처리됩니다. 컴퓨터가 꺼져 있어도 자동 실행되는 서버 스케줄러는 다음 Sprint에서 Vercel Cron 또는 외부 스케줄러와 연결합니다.
