# GY-NEXUS 한국형 자동 쇼핑 쇼츠 제작기 배포 가이드

운영 도메인: `https://gynexus.com`  
기준 프로젝트: Vercel `gy-nexus-zfpq`  
기준 소스: GitHub `young890a-stack/GY-NEXUS`의 `main` 커밋 `249e40c6d0f0ca23d4662d75c772ff1a4fae6880`

## 1. 이번 기능이 하는 일

1. 상품 URL 하나 또는 상품정보를 한 번 입력합니다.
2. 상품 페이지의 이름, 설명, 이미지, 구조화된 후기 정보를 읽습니다.
3. 한국 소비자의 불편, 핵심 특징, 후기 인사이트, 판매 포인트를 분석합니다.
4. 문제해결형·시각적 반전형·비교/증거형 훅 3개를 만듭니다.
5. 훅마다 15초·20초·30초 버전을 만들어 총 9개 제작안을 만듭니다.
6. 한국어 대본, 장면표, 자막, SRT, 제목, 설명, 해시태그, 썸네일 문구를 완성합니다.
7. 8개 품질항목을 코드 검사와 AI 심사로 이중 평가합니다.
8. 기준 미달 버전은 최대 2회 자동 수정하며, 끝까지 미달이면 영상 제작을 차단합니다.
9. 합격 버전만 기존 AI 음성·Supabase·Render·FFmpeg 9:16 MP4 제작 흐름으로 보냅니다.
10. 업로드 후 조회·시청·클릭·주문 데이터를 저장하고 성과가 검증된 훅/길이를 다음 제작에 재사용합니다.

첫 결과는 자동으로 공개하지 않습니다. 영상이 완성되어도 기존 GY-NEXUS의 비공개 검수·대표 승인 단계를 유지합니다.

## 2. 가장 먼저 할 일: Supabase SQL 실행

1. Supabase 대시보드에 로그인합니다.
2. 왼쪽 메뉴에서 **SQL Editor**를 엽니다.
3. `supabase/migrations/20260726_korean_auto_shopping_shorts.sql` 파일 전체를 복사합니다.
4. SQL Editor에 붙여넣고 **Run**을 누릅니다.
5. 오류 없이 완료되면 다음 표가 생겼는지 확인합니다.

- `shopping_shorts_runs`
- `shopping_shorts_variants`
- `shopping_shorts_metrics`
- `shopping_shorts_patterns`

이 SQL은 다시 실행해도 안전하게 작성되어 있습니다. 브라우저의 익명 키로 표를 직접 읽거나 쓸 수 없고, 로그인한 관리자 요청을 받은 서버만 service role로 접근합니다.

## 3. Vercel 환경변수

Vercel 대시보드 → `gy-nexus-zfpq` → **Settings** → **Environment Variables**에서 입력합니다. 비밀값은 ZIP이나 소스 파일에 넣지 마세요.

### 반드시 필요한 값

| 이름 | 설명 |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://gynexus.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `OWNER_EMAIL` | 관리자 로그인 이메일 |
| `OPENAI_API_KEY` | 상품 분석, 대본, 품질검수, 음성 생성 |
| `OPENAI_STRATEGY_MODEL` | 권장: 현재 프로젝트 값 유지 |
| `OPENAI_QUALITY_MODEL` | 권장: 현재 프로젝트 값 유지 |
| `OPENAI_IMAGE_MODEL` | AI 장면 이미지 모델 |
| `RUNWAYML_API_SECRET` | AI 장면 영상화에 사용하는 기존 Runway 키 |
| `CREATIVE_STORAGE_BUCKET` | 기본값 `creative-assets` |
| `VIDEO_WORKER_URL` | Render 영상 워커의 공개 HTTPS 주소 |
| `VIDEO_WORKER_SECRET` | Vercel과 Render에 똑같이 넣는 긴 임의 비밀문자 |

### 쇼츠 제작기 권장값

| 이름 | 권장값 | 설명 |
|---|---:|---|
| `SHORTS_LAB_QUALITY_THRESHOLD` | `86` | 기획안 총점 합격 기준 |
| `SHORTS_LAB_MAX_REGENERATIONS` | `2` | 기준 미달 자동 수정 횟수 |
| `SHORTS_LEARNING_MIN_SAMPLE` | `5` | 성과 패턴을 다음 제작에 쓰기 위한 최소 표본 |
| `SHORTS_QUALITY_THRESHOLD` | `85` | 기존 장면 이미지 품질 기준 |
| `SHORTS_MAX_IMAGE_RETRIES` | `2` | 기존 장면 이미지 재생성 횟수 |
| `OPENAI_TTS_MODEL` | 비워도 기본값 사용 | 기존 AI 음성 모델 |
| `OPENAI_TTS_VOICE_FEMALE` | 비워도 기본값 사용 | 여성 음성 프리셋 |
| `OPENAI_TTS_VOICE_MALE` | 비워도 기본값 사용 | 남성 음성 프리셋 |

YouTube 비공개 업로드까지 사용하려면 기존 `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`을 유지하고 `YOUTUBE_REDIRECT_URI`는 `https://gynexus.com/api/connections/youtube/callback`으로 설정합니다. Google OAuth 앱에도 같은 주소를 승인된 리디렉션 URI로 등록합니다.

## 4. Render 영상 워커

현재 `render.yaml`과 `video-worker/Dockerfile`을 그대로 사용합니다. Dockerfile은 FFmpeg와 한글 Noto 글꼴을 자동 설치합니다.

Render 서비스에 다음 값을 넣습니다.

| 이름 | 값 |
|---|---|
| `VIDEO_WORKER_SECRET` | Vercel과 동일한 값 |
| `GY_APP_ORIGIN` | `https://gynexus.com` |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `CREATIVE_STORAGE_BUCKET` | `creative-assets` |

배포 후 `https://<Render주소>/health`가 정상 응답하는지 확인하고, 그 주소를 Vercel의 `VIDEO_WORKER_URL`에 넣습니다.

Vercel의 `gy-nexus-zfpq`는 프로젝트 식별용 이름입니다. 고객과 OAuth, Render 콜백이 사용하는 기준 주소는 모두 `https://gynexus.com`이어야 합니다. Vercel 임시 주소를 운영 기준 주소로 넣지 마세요.

## 5. Vercel `gy-nexus-zfpq`에 배포

### GitHub 자동배포를 쓰는 경우

1. 기존 GY-NEXUS 폴더를 별도로 백업합니다.
2. 제공한 전체 교체용 ZIP을 새 폴더에 풉니다.
3. 기존 Git 저장소의 파일을 새 파일로 교체하되 `.env.local`은 올리지 않습니다.
4. 변경 내용을 `main`이 아닌 새 브랜치에 커밋합니다.
5. 미리보기 배포에서 먼저 확인한 뒤 `main`에 병합합니다.
6. Vercel이 `gy-nexus-zfpq`에 자동 배포하는지 확인합니다.

### Vercel CLI를 쓰는 경우

프로젝트 루트에서 Vercel 계정에 로그인한 뒤 기존 프로젝트 `gy-nexus-zfpq`를 선택합니다. 새 프로젝트를 만들지 마세요. Production 배포 전에 Preview 배포에서 아래 점검표를 먼저 확인하세요.

## 6. 사용 방법

1. GY-NEXUS 관리자 계정으로 로그인합니다.
2. 왼쪽 메뉴의 **자동 쇼핑 쇼츠**를 엽니다.
3. 상품 URL을 붙여넣고 **9개 쇼츠 제작안 자동 만들기**를 누릅니다.
4. 판매 사이트가 읽기를 차단하면 **상품정보·후기·순이익 직접 입력**을 열어 보완합니다.
5. 3개 훅과 각 15초·20초·30초 결과의 품질점수를 확인합니다.
6. 필요한 경우 SRT와 게시문을 바로 내려받습니다.
7. 합격 버전에서 **AI 음성·9:16 MP4 자동 완성**을 누릅니다.
8. 기존 제작기가 장면, 음성, 자막, 썸네일, MP4를 자동으로 완성합니다.
9. 완성본을 직접 확인한 뒤에만 비공개 게시 대기열로 보냅니다.
10. 게시 후 성과 학습 영역에 실제 수치를 기록합니다.

## 7. 운영 점검표

- 상품 이미지가 실제 상품과 정확히 같은가
- 상품 설명과 후기만 근거로 대본이 작성됐는가
- 합격 버전만 MP4 제작 버튼이 열리는가
- SRT 시작 시간이 `00:00:00,000`이고 마지막 시간이 영상 길이와 같은가
- 한국어 음성이 장면과 자막에 맞는가
- 출력 영상이 9:16이며 H.264/AAC MP4인가
- 공개 게시 전에 대표 승인 단계에서 멈추는가
- 링크 클릭, 주문, 광고비가 같은 영상 버전에 연결되는가
- 공급가·배송비·수수료·광고비·반품 충당금을 뺀 순이익이 양수인가

## 8. 알아둘 제한

- 쿠팡 등 일부 판매 사이트는 자동 읽기를 차단합니다. 이때는 확인된 상품명·설명·이미지를 직접 입력해야 합니다.
- AI 생성과 품질검수에는 OpenAI 사용료가 발생합니다.
- 장면 영상화에는 이미지/영상 제공사의 사용료와 처리시간이 발생합니다.
- Render 무료 서비스는 잠자기 상태에서 첫 요청이 늦을 수 있습니다.
- 조회수가 높아도 구매 의도가 낮을 수 있으므로 클릭·주문·순이익을 함께 평가해야 합니다.
