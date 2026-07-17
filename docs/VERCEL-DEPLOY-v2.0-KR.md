# Vercel 배포 가이드 — v2.0

1. GitHub 저장소에 프로젝트를 업로드합니다. `.env.local`은 제외합니다.
2. Vercel에서 저장소를 Import합니다.
3. Framework Preset은 Next.js, Build Command는 `npm run build`를 사용합니다.
4. Project Settings → Environment Variables에 `.env.example`의 필요한 키를 입력합니다.
5. `NEXT_PUBLIC_SITE_URL`은 실제 Vercel 도메인으로 설정합니다.
6. Google OAuth 승인된 리디렉션 URI에도 실제 도메인의 콜백 주소를 추가합니다.
7. 배포 후 `/api/system/health`와 `/admin/system-status`를 확인합니다.

## 출시 전 보안 확인
- Service Role Key가 `NEXT_PUBLIC_` 접두사로 노출되지 않았는지 확인
- OAuth Client Secret이 클라이언트 컴포넌트에 포함되지 않았는지 확인
- Supabase RLS 활성화 확인
- 관리자 경로의 인증 정책 확인
