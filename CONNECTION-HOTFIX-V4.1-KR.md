# GY-NEXUS 연결센터 V4.1 긴급 보완

## 1. 설정 화면 복구

`/admin/settings`에서 `Cannot convert undefined or null to object`가 발생하던 원인을 수정했습니다.

- 진단 API의 현재 `services` 응답 형식과 화면을 일치시켰습니다.
- 응답이 비어 있거나 형식이 달라도 화면 전체가 중단되지 않습니다.
- 필수 환경변수 누락과 선택 환경변수를 구분해 표시합니다.
- 설정 화면에서 통합 연결센터로 바로 이동할 수 있습니다.

## 2. 네이버 개발자센터에 입력할 값

네이버 개발자센터의 `Application → 내 애플리케이션 → GY-NEXUS → API 설정`에서 확인합니다.

- 사용 API: `네이버 로그인` 선택
- 로그인 오픈 API 서비스 환경: `PC 웹` 추가
- 서비스 URL: `https://gy-nexus-zfpq.vercel.app`
- 네이버 로그인 Callback URL: `https://gy-nexus-zfpq.vercel.app/api/connections/naver/callback`

Callback URL 마지막에 `/`를 추가하지 않습니다.

애플리케이션 개요의 Client ID가 Vercel `NAVER_CLIENT_ID`에 저장된 값과 같은지도 확인합니다. Client Secret은 Vercel `NAVER_CLIENT_SECRET`과 같아야 하지만 채팅이나 화면 캡처에 공개하지 않습니다.

## 3. Vercel 환경변수

```text
NAVER_REDIRECT_URI=https://gy-nexus-zfpq.vercel.app/api/connections/naver/callback
```

변경 후 Vercel 최신 배포를 Redeploy하거나 GitHub에 새 커밋을 push합니다.

## 4. 배포 명령

ZIP을 기존 GY-NEXUS 폴더에 전체 덮어쓴 후 실행합니다.

```powershell
npm ci
npm run build
git add .
git commit -m "Fix settings diagnostics and Naver login guide"
git push origin main
```

Vercel 환경변수의 콜백 주소까지 자동으로 맞추려면 올바른 Vercel 인증 상태에서 다음을 먼저 실행합니다.

```powershell
npm run vercel:setup
```

## 검증

- TypeScript 오류 0개
- ESLint 오류 0개
- Next.js 16.2.10 프로덕션 빌드 성공
- `/admin/settings`, `/admin/connections`, Naver start/callback 라우트 생성 확인

