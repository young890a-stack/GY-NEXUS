# 설치 순서

1. 기존 프로젝트의 `.env.local`을 별도 백업한다.
2. 이 ZIP 전체를 기존 GY-NEXUS 폴더에 덮어쓴다.
3. `.env.local`을 다시 넣는다.
4. Supabase SQL Editor에서 `supabase/migrations/V2.0-SPRINT-1-PIPELINE.sql`을 실행한다.
5. 터미널에서 다음을 실행한다.

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run build
npm run dev
```

6. `http://localhost:3000/admin/company-os-v2`에서 확인한다.

## 이번 Sprint에서 실제 작동하는 범위

- 상품 정보 수동 입력
- 상품 데이터 완성도 평가
- 기회·콘텐츠·썸네일 계획 생성
- 제휴 링크 미입력 시 게시 잠금 판단
- 블로그/쇼츠/썸네일 품질 게이트 표시

## 아직 연결하지 않은 범위

- 쿠팡·Temu 실시간 인기상품 자동 수집
- 이미지 모델을 통한 실제 썸네일 파일 생성
- Blogger 실제 예약 게시
- 플랫폼 성과 자동 회수

이 항목들은 외부 계정과 공식 제공 범위를 확인한 뒤 순서대로 연결한다.
