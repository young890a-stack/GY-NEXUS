# GY First Release Production 1.0 · Build 03

## Customer Platform

- 회원가입·로그인·이메일 인증 콜백
- 일반 회원 / Creator 계정 유형
- 관심분야 기반 개인화 프로필
- 마이페이지 통계
- 북마크·댓글·알림·문의 관리 화면
- 회원·비회원 고객지원 문의
- Owner 전용 Customer Center CRM
- 회원 알림·좋아요·조회 기록 DB
- 관리자 Owner 이메일 제한 옵션

## 적용 SQL

`supabase/BUILD-03-CUSTOMER-PLATFORM.sql`

## 환경변수

`OWNER_EMAIL=`에 유일한 관리자 이메일을 입력하면 `/admin`은 해당 계정만 접근할 수 있습니다.
미입력 상태에서는 기존 호환성을 위해 로그인 사용자 접근 방식을 유지합니다.
