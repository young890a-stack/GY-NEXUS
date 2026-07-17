# Sprint 6 · Revenue Dashboard + Learning Engine

## 적용
1. 기존 프로젝트를 백업합니다.
2. 이 ZIP의 파일을 전체 덮어씁니다.
3. Supabase SQL Editor에서 `supabase/SPRINT-6-REVENUE-LEARNING.sql`을 실행합니다.
4. PowerShell에서 다음을 실행합니다.

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run build
npm run dev
```

## 주요 주소
- `/admin/revenue-dashboard` CEO Revenue Dashboard
- `/admin/learning-engine` Learning Engine
- `/admin/ai-advisor` AI Advisor
- `/admin/forecast` Forecast Engine

## 데이터 구조
모든 채널 성과는 `revenue_events`에 정규화합니다. 공식 API가 없는 채널은 CSV 또는 수동 입력 API로 추가할 수 있습니다.

POST `/api/revenue/events`
```json
{"channel":"YouTube","title":"콘텐츠 제목","views":1000,"clicks":120,"conversions":5,"revenue":25000}
```

데이터가 없을 때 Dashboard는 DEMO DATA를 표시합니다. 실제 이벤트가 저장되면 LIVE DATA로 전환됩니다.

## Learning Engine 원칙
- 수익을 보장하지 않습니다.
- 최소 표본과 신뢰도를 구분합니다.
- 자동 게시보다 대표 승인 규칙을 우선합니다.
- `POST /api/learning/recompute`로 채널별 학습 규칙을 갱신합니다.
