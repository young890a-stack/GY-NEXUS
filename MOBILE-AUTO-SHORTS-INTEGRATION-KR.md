# GY-NEXUS 모바일 원클릭 쇼츠 통합 안내

## 새 모바일 화면

운영 사이트 로그인 후 아래 주소로 접속합니다.

`/admin/mobile-auto-shorts`

모바일에서는 관리자 화면 아래쪽에 고정된 **원클릭** 버튼을 누르면 바로 열립니다.

## 한 화면에 연결된 작업 순서

1. 저장된 상품 또는 수익기회 상위 상품 선택
2. 쿠팡·Temu·네이버·알리 제휴링크 자동 불러오기
3. 중국 공개 인기 영상의 훅·촬영각도·판매 순서 분석
4. 한국형 대본·정확한 자막·썸네일 패키지 생성
5. OpenAI 이미지 생성 및 85점 품질검수
6. 한국어 AI 음성 생성
7. Runway 장면 영상 생성
8. 영상 Worker에서 9:16 MP4 합성
9. 대표 최종 확인
10. YouTube 비공개 게시 대기열 등록

중국 영상 원본은 최종 영상에 사용하지 않고, 인기 구조 분석에만 사용하도록 연결되어 있습니다.

## 모바일 사용성 개선

- 긴 관리자 메뉴를 접을 수 있는 전체 메뉴 버튼으로 변경
- 화면 아래 고정 빠른 메뉴: 홈, 원클릭, 상품, 게시, 연결
- 제휴링크 붙여넣기만으로 상품명·이미지·가격 자동 수집
- 판매 사이트가 자동 읽기를 막으면 상품명·이미지 주소를 직접 보완 가능
- 상품 카드 가로 스와이프 지원
- 핵심 제작 버튼을 모바일 화면 하단에서 쉽게 누를 수 있도록 고정
- 영상 길이·수수료율·AI 목소리 설정을 기기에 기억
- 상품 수집, 중국 연구소, 정밀 편집, 게시센터, 연결센터 바로가기 제공

## 실제 연동 API

- `/api/revenue-shorts/product-import`
- `/api/creative-studio-pro/china-search`
- `/api/creative-studio-pro/projects`
- `/api/creative-studio-pro/projects/[id]/media-references`
- `/api/creative-studio-pro/projects/[id]/source-mix`
- `/api/creative-studio-pro/projects/[id]/productization`
- `/api/creative-studio-pro/projects/[id]/content-approval`
- `/api/creative-studio-pro/projects/[id]/prepare-next`
- `/api/creative-studio-pro/projects/[id]/voice`
- `/api/creative-studio-pro/projects/[id]/approve-render`
- `/api/creative-studio-pro/projects/[id]/generate-next`
- `/api/creative-studio-pro/projects/[id]/render`
- `/api/publishing/jobs`

## 배포

기존 GY-NEXUS 폴더에 완성 ZIP의 내용을 덮어쓴 뒤 아래 명령을 실행합니다.

```powershell
git add .
git commit -m "Add mobile one-click shorts workspace"
git push
```

Vercel이 자동으로 운영 배포를 시작합니다. 별도의 새 환경변수나 SQL은 추가하지 않았으며, 기존 Creative Studio Pro·Runway Worker·Supabase·게시센터 설정을 그대로 사용합니다.
