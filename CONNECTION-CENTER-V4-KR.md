# GY-NEXUS 통합 연결센터 V4

이 버전은 외부 서비스 연결 시 발생하던 404, redirect_uri 불일치, 승인 후 저장 실패를 한곳에서 진단하고 복구하기 위한 버전입니다.

## 대표님이 배포 후 할 일

1. ZIP을 기존 `GY-NEXUS` 폴더에 전체 덮어씁니다.
2. PowerShell에서 아래 명령을 실행합니다.

```powershell
npm ci
npm run typecheck
npm run build
npm run vercel:setup
git add .
git commit -m "Upgrade unified connection center"
git push origin main
```

`npm run vercel:setup`은 운영 프로젝트 `gy-nexus-zfpq`의 사이트 주소와 네 개 콜백 환경변수를 Production·Preview에 자동 추가·수정합니다. Vercel 로그인 또는 올바른 `VERCEL_TOKEN`이 필요합니다.

## 외부 개발자 콘솔에 한 번 등록할 주소

| 서비스 | 등록할 Callback / Redirect URI |
|---|---|
| YouTube | `https://gy-nexus-zfpq.vercel.app/api/connections/youtube/callback` |
| Google Blogger | `https://gy-nexus-zfpq.vercel.app/api/connections/blogger/callback` |
| Naver | `https://gy-nexus-zfpq.vercel.app/api/connections/naver/callback` |
| Search Console · GA4 | `https://gy-nexus-zfpq.vercel.app/api/search-console/callback` |

Google OAuth Client를 하나만 공통으로 사용하면 Google Cloud의 해당 Client에 YouTube·Blogger·Search Console 주소 세 개를 모두 추가합니다. 서비스별 Client를 사용하면 각 Client에 해당 주소만 등록합니다.

주의: Google과 Naver의 개발자 콘솔은 GY-NEXUS 코드가 대신 변경할 수 없습니다. 위 주소를 외부 콘솔에 한 번 저장해야 하며, 주소는 대소문자·경로·슬래시까지 정확히 일치해야 합니다.

## 통합 연결센터 사용법

배포 후 대표 계정으로 다음 주소에 접속합니다.

`https://gy-nexus-zfpq.vercel.app/admin/connections`

- 연동 자동 진단: 운영 주소, 콜백 경로, 토큰 암호화 준비 여부를 검사합니다.
- 콜백 주소 모두 복사: 외부 개발자 콘솔에 등록할 주소를 한꺼번에 복사합니다.
- 계정 연결: 이 버튼에서 OAuth를 시작해야 안전한 state 검증이 이어집니다.
- 연결 테스트: Coupang API 서명과 Temu 제휴 링크 형식을 실제로 검증합니다.
- 상태 다시 검사: 저장된 토큰으로 실제 채널·블로그·사이트·프로필을 조회합니다.

## 실패 메시지의 뜻

| 화면 메시지 | 원인과 조치 |
|---|---|
| Client ID 또는 Secret 없음 | 해당 환경변수를 Production에 추가하고 재배포합니다. |
| 연결 시간이 만료됨 | 다른 탭이나 예전 링크가 아니라 연결센터 버튼에서 다시 시작합니다. |
| 콜백 주소 또는 Secret 불일치 | 카드에 표시된 콜백 주소와 외부 콘솔의 주소를 정확히 맞춥니다. |
| 토큰 저장 실패 | `SUPABASE_SERVICE_ROLE_KEY` 또는 선택값 `CONNECTION_ENCRYPTION_KEY`를 확인합니다. |
| 권한 승인 취소 | 다시 연결하고 필요한 권한을 승인합니다. |
| 외부 서비스 응답 없음 | 잠시 후 연결센터에서 다시 시도합니다. |

## 환경변수 원칙

- `NEXT_PUBLIC_SITE_URL=https://gy-nexus-zfpq.vercel.app`
- `YOUTUBE_REDIRECT_URI`, `BLOGGER_REDIRECT_URI`, `NAVER_REDIRECT_URI`, `SEARCH_CONSOLE_REDIRECT_URI`는 설치 스크립트가 운영 주소로 맞춥니다.
- `CONNECTION_ENCRYPTION_KEY`는 선택입니다. 비워두면 기존 `SUPABASE_SERVICE_ROLE_KEY`에서 연동 토큰 전용 암호화 키를 파생합니다.
- Client Secret, API Key, Service Role Key는 Vercel에서 Sensitive로 유지합니다.
- `NEXT_PUBLIC_`로 시작하는 두 Supabase 공개값은 브라우저에서 사용하는 공개 설정값입니다. Service Role Key와 혼동하지 마세요.
- 로컬 테스트가 아니라면 콜백 주소에 `http://localhost:3000`을 사용하지 않습니다.

## 이번 버전에서 막은 404 경로

현재 표준 경로 외에 예전 설치 안내에서 쓰였던 아래 경로도 호환 라우트로 유지합니다.

- `/api/auth/youtube/callback`
- `/api/auth/blogger/callback`
- `/api/auth/naver/callback`
- `/api/connections/google/callback`

이 경로는 더 이상 404가 나지 않습니다. 다만 새 연결은 연결센터 카드에 표시되는 표준 주소를 외부 콘솔에 등록하는 것이 가장 안전합니다.

## 보안

- OAuth callback만 로그인 미들웨어를 통과할 수 있게 열고, 무작위 `state` 쿠키 일치 검사를 통과한 요청만 토큰을 저장합니다.
- 시작·상태·진단·테스트·연결 해제 API는 대표 계정만 사용할 수 있습니다.
- 진단 API와 화면은 Client Secret, API Key, OAuth token 값을 반환하거나 표시하지 않습니다.
- 토큰은 AES-256-GCM으로 암호화된 HttpOnly 쿠키에 저장됩니다.
