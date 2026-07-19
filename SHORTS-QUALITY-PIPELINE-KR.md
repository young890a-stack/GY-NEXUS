# GY-NEXUS 프리미엄 쇼츠 품질 파이프라인

## 이번에 실제로 연결한 기능

1. 실제 상품 사진을 1~4장 업로드합니다. 정확도를 위해 앞·뒤·측면·사용 장면을 포함한 2~4장을 권장합니다.
2. GPT Image 2가 각 5초 장면마다 저품질 초안 후보 3개를 한 번에 생성합니다.
3. 별도의 시각 검수 AI가 상품 일치도 40%, 왜곡 20%, 자연스러움 15%, 구도 15%, 과장 위험 10%로 평가합니다.
4. 기준을 통과한 후보만 GPT Image 2 고품질 최종본으로 다시 만들고 재검수합니다.
5. 기준 미달이면 최대 2회까지만 자동 재생성하고, 이후에는 보류합니다. 보류 장면에는 Runway 비용을 사용하지 않습니다.
6. 모든 장면이 통과해야 `Runway 비용 승인` 버튼이 활성화됩니다.
7. 대표가 직접 승인한 뒤에만 각 장면의 최종 이미지가 Runway image-to-video로 전송됩니다.
8. 완성 후 SRT 자막, CapCut 안내서, 편집 JSON을 내려받을 수 있습니다.

## 배포 순서

### 1. Supabase SQL 한 번 실행

Supabase 프로젝트의 `SQL Editor`에서 아래 파일 내용을 전부 붙여 넣고 `Run`을 누릅니다.

`supabase/SHORTS-QUALITY-PIPELINE-MIGRATION.sql`

이 SQL은 기존 프로젝트와 장면 데이터를 지우지 않고 품질검수 열만 추가합니다.

### 2. Vercel 환경변수 자동 설정

프로젝트 폴더의 터미널에서 아래 두 줄을 실행합니다. 첫 줄은 대표님의 브라우저에서 Vercel 로그인을 한 번 진행합니다.

```bash
npx vercel@latest login
npm run vercel:setup
```

스크립트는 `gy-nexus-zfpq` 프로젝트를 정확히 연결하고 Production과 Preview에 다음 안전한 값만 자동 추가·수정합니다.

```env
NEXT_PUBLIC_SITE_URL=https://gy-nexus-zfpq.vercel.app
OPENAI_MODEL=gpt-5.6-terra
OPENAI_STRATEGY_MODEL=gpt-5.6-sol
OPENAI_MEMBER_MODEL=gpt-5.6-luna
OPENAI_QUALITY_MODEL=gpt-5.6-sol
OPENAI_IMAGE_MODEL=gpt-image-2
RUNWAY_VIDEO_MODEL=gen4.5
CREATIVE_STORAGE_BUCKET=creative-assets
SHORTS_QUALITY_THRESHOLD=85
SHORTS_MAX_IMAGE_RETRIES=2
SEARCH_CONSOLE_REDIRECT_URI=https://gy-nexus-zfpq.vercel.app/api/search-console/callback
```

`OPENAI_API_KEY`, `RUNWAYML_API_SECRET`, Supabase 키처럼 민감한 값은 수정하지 않고 존재 여부만 확인합니다. 누락되면 이름을 알려주므로 Vercel Dashboard에서 직접 입력합니다. 비밀값을 스크립트, `.env` 파일 또는 GitHub에 넣지 않습니다. ChatGPT 월 구독과 OpenAI API 요금은 서로 별도입니다.

다른 팀 계정에 프로젝트가 있다면 Vercel 팀 주소의 slug를 붙여 실행합니다.

```bash
npm run vercel:setup -- --scope 팀-slug
```

실제로 변경하기 전에 명령만 확인하려면 다음 미리보기를 사용합니다.

```bash
npm run vercel:setup -- --dry-run
```

### 3. 코드 덮어쓰기와 배포

이 압축파일을 기존 GitHub 프로젝트 루트에 덮어쓴 뒤 아래 명령만 실행합니다.

```bash
git add .
git commit -m "Add premium shorts quality pipeline and Vercel setup"
git push origin main
```

Vercel은 GitHub의 `main` 변경을 감지해 자동 재배포합니다. 같은 저장소에 연결된 중복 Vercel 프로젝트 4개를 모두 운영할 필요는 없습니다. 실제로 사용할 한 프로젝트만 남기고 환경변수도 그 프로젝트에만 관리하는 편이 안전합니다.

## 실제 사용 순서

1. 관리자 화면에서 `AI Factory → Creative Studio Pro`를 엽니다.
2. 상품명과 검증된 상품 설명을 입력합니다.
3. 실제 상품 사진 2~4장을 올리고 프로젝트를 만듭니다.
4. 먼저 `전체 이미지 검수`를 누릅니다. 이 단계에서는 OpenAI 이미지·검수 API 비용만 발생합니다.
5. 각 장면의 점수, 상품 일치도, 손·글자·로고 오류, 과장 위험을 확인합니다.
6. 모든 장면이 통과하면 `Runway 비용 승인`을 누릅니다.
7. `남은 영상 모두 생성`을 누릅니다. 이때부터 Runway 크레딧이 사용됩니다.
8. CapCut에서는 장면 MP4를 순서대로 놓고 `SRT 자막`을 가져옵니다. CapCut 자동 자막은 다시 실행하지 않습니다.

## CapCut 연결의 정확한 범위

현재는 CapCut의 비공개 프로젝트 파일을 조작하지 않습니다. 공개적으로 안정된 범용 제작 API에 기대지 않고, SRT·장면 URL·편집 순서를 내보내는 안전한 방식입니다. CapCut에서 마지막 효과음, 짧은 전환, 색보정만 하면 됩니다. CapCut 내부 형식을 억지로 자동 생성하면 앱 업데이트 때 깨지거나 계정 정책 문제가 생길 수 있어 사용하지 않았습니다.

## 꼭 알아둘 한계

- AI 이미지가 실제 상품과 100% 동일하다고 보장할 수는 없습니다. 자동 검수에 더해 판매 전 사람의 최종 확인이 필요합니다.
- 로고, 인증마크, 가격, 효능 문구는 생성 이미지 안에 넣지 않습니다. 정확한 문구는 CapCut 자막이나 그래픽으로 추가합니다.
- 최종 MP4 자동 합성은 기존 `VIDEO_WORKER_URL`이 연결된 경우에만 실행됩니다. Worker가 없더라도 장면 MP4와 SRT를 CapCut에서 바로 편집할 수 있습니다.
- OpenAI 조직은 GPT Image 모델 사용 전에 조직 인증이 필요할 수 있습니다.

## 배포 후 1회 점검

- 테스트 상품 사진 2장을 업로드할 수 있는지
- 이미지 후보 3개와 품질 점수가 표시되는지
- 품질 미달 장면에서 Runway 버튼이 잠기는지
- 전체 통과 후에만 Runway 승인 버튼이 활성화되는지
- SRT 자막의 시작·종료 시간이 장면과 맞는지
- 일반 회원이 `/admin/creative-studio-pro`와 비용 API에 접근할 수 없는지
