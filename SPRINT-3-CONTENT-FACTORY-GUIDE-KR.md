# Sprint 3 · Content Factory

## 추가된 운영 기능
- Product Intelligence에서 승인된 products 상품 선택
- AdSense / AdPost / 제휴판매 / 리뷰 목적별 블로그 생성
- 15·20·25·30초 쇼츠 대본과 장면표 생성
- 정확한 한국어 SRT 생성 및 다운로드
- 16:9·1:1 썸네일 프롬프트와 9:16 영상 프롬프트 생성
- SEO 제목, 메타 설명, 키워드, 슬러그, FAQ 생성
- Supabase 제작 이력 저장 및 최근 패키지 다시 불러오기
- 전체 결과 Markdown·JSON 다운로드

## 설치
1. 기존 `.env.local`을 보존합니다.
2. Supabase SQL Editor에서 `supabase/SPRINT-3-CONTENT-FACTORY.sql`을 실행합니다.
3. PowerShell에서 아래를 실행합니다.

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run build
npm run dev
```

접속: `http://localhost:3000/admin/content-factory`

`OPENAI_API_KEY`가 필요합니다. 외부 AI 호출 결과는 입력된 상품 설명 범위 안에서 생성하도록 정책 지시가 포함되어 있습니다.
