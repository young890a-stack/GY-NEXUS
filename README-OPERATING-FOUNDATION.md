# GY-NEXUS 운영형 기반 교체본

이 ZIP은 기존 프로젝트를 버리고 새 프로젝트로 시작하는 파일이 아니라, 업로드된 현재 프로젝트를 기준으로 운영형 구조의 첫 기반을 통합한 전체 교체본입니다.

## 이번 교체본에 포함된 실제 변경

- AI 운영 비서 화면과 명령→실행계획 변환 API
- 게시·예약 작업에 대표 승인 표시
- 초기 설치 마법사
- 통합 연결센터 재구성
- YouTube 기존 OAuth 유지
- Google Blogger OAuth 연결, 블로그 목록 확인, Blog ID 선택 기반
- Naver 계정 연결 유지
- Temu 상품별 제휴 링크 운영 방식 반영
- AI 비서 실행 이력과 연결 프로필을 위한 Supabase 테이블
- 모바일 대응 UI

## 대표님이 해야 하는 작업

1. 기존 프로젝트 폴더를 통째로 백업합니다.
2. 이 ZIP을 새 폴더에 압축 해제합니다.
3. 기존 `.env.local`을 새 폴더로 복사합니다.
4. `.env.example`을 보고 Blogger 항목만 추가합니다.
5. Supabase SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
6. `1-처음설치.bat`을 한 번 실행합니다.
7. `2-서버실행.bat`으로 실행합니다.
8. `/admin/setup`에서 연결 상태를 확인합니다.

## Google Blogger 준비

Google Cloud에서 Blogger API v3를 사용 설정하고 기존 OAuth 클라이언트의 승인된 리디렉션 URI에 다음 주소를 추가합니다.

`http://localhost:3000/api/connections/blogger/callback`

YouTube와 같은 Google OAuth 클라이언트를 쓸 경우 BLOGGER_CLIENT_ID/SECRET을 비워도 YOUTUBE_CLIENT_ID/SECRET을 재사용하도록 구현되어 있습니다. 명확한 운영을 위해서는 동일 값을 Blogger 항목에도 입력하는 방식을 권장합니다.

## 정직한 범위

이 교체본은 최종 전체 기능을 완성했다고 이름 붙인 파일이 아닙니다. 최종 운영형을 뜯어고치지 않고 확장하기 위한 기반 교체본입니다. 이미지 생성, 15~30초 MP4 렌더링, 정확한 자막 삽입, Blogger 실제 게시 버튼, YouTube 예약 업로드, 실패 재시도 워커는 이 구조 위에 이어서 구현해야 합니다.
