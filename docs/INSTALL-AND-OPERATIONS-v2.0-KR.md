# GY-NEXUS AI COMPANY OS v2.0 설치 및 운영 매뉴얼

## 1. 교체 설치
1. 기존 프로젝트 폴더와 `.env.local`을 별도로 백업합니다.
2. 이 ZIP을 압축 해제하고 기존 프로젝트에 전체 덮어쓰기합니다.
3. 기존 `.env.local`은 유지합니다. 없으면 `.env.example`을 복사합니다.
4. Supabase SQL Editor에서 `supabase/GY-NEXUS-V2.0-FINAL.sql`을 실행합니다.
5. PowerShell에서 아래 명령을 실행합니다.

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run release:check
npm run build
npm run dev
```

## 2. 첫 접속
- 메인: `http://localhost:3000`
- CEO Dashboard: `http://localhost:3000/admin`
- 운영 상태: `http://localhost:3000/admin/system-status`
- 연결센터: `http://localhost:3000/admin/connections`
- Health API: `http://localhost:3000/api/system/health`

## 3. 운영 원칙
- API 키는 GitHub에 올리지 않습니다.
- `.env.local`과 Supabase Service Role Key는 관리자 PC 또는 Vercel 환경변수에만 저장합니다.
- 외부 게시 전에는 채널별 OAuth 권한과 공개 범위를 확인합니다.
- 첫 운영 1주일은 자동 게시보다 검토 후 승인 방식을 권장합니다.

## 4. 장애 발생 시
1. `.next` 폴더 삭제
2. `npm install`
3. `npm run typecheck`
4. `npm run build`
5. `/admin/system-status`에서 연결 상태 확인
