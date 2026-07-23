# GY-NEXUS 한국형 쇼츠 스튜디오 V2 수정본

이전 V1은 Gemini API, Supabase 영상 업로드, 자동 MP4까지 한 번에 직접 연결해 기존 프로젝트와 충돌 가능성이 컸습니다.  
V2는 먼저 **확실히 작동하는 한국형 쇼츠 제작 흐름**으로 단순화했습니다.

## 실제 작동 흐름

1. 상품명 또는 제휴링크 입력
2. 기존 Content Factory API로 한국형 쇼츠 대본 생성
3. 초 단위 장면표 생성
4. 정확한 한국어 SRT 생성
5. Gemini 분석 프롬프트 복사
6. 선택한 사진·영상을 Gemini에 직접 첨부
7. SRT와 CapCut 편집 가이드 다운로드
8. 유튜브 롱폼 URL을 AlphaCut으로 전달
9. 기존 Creative Studio Pro에서 사이트 자동 MP4 제작 계속

## 메뉴

최상단:

- 한국형 쇼츠 스튜디오
- 중국 쇼핑 숏폼 제작실
- 블로그 제작실
- 상품 관리

중국 숏폼 제작실은 그대로 보존됩니다.

## 중복 메뉴

사이드바에서 아래 중복 노출을 제거했습니다.

- 모바일 원클릭 쇼츠
- 중국 영상 연구소
- 구형 Creative Studio
- 구형 AI 콘텐츠
- Company OS 1.0 보관
- 기존 매출 분석
- 설치 마법사

내부 페이지는 성급하게 삭제하지 않습니다.

## 이전 V1 복구

V2 설치기는 이전 V1에서 추가한 아래 불안정 파일을 자동으로 제거합니다.

- `app/api/korean-shorts/generate/route.ts`
- `lib/korean-shorts/types.ts`
- `lib/korean-shorts/fallback.ts`

새 한국형 쇼츠 화면은 기존 `/api/content-factory/generate`를 사용합니다.

## 적용 방법

1. 압축을 풉니다.
2. 압축을 푼 폴더를 아래 위치 안에 넣습니다.

```text
C:\Users\홍영택\Documents\GitHub\GY-NEXUS
```

3. 아래 파일을 더블클릭합니다.

```text
1-한국형쇼츠V2수정적용.bat
```

4. 자동으로 다음 작업을 수행합니다.

- 이전 `PATCH` 폴더 제거
- 기존 파일 백업
- V2 파일 적용
- V1 불안정 파일 제거
- `npm run build`
- 실패 시 자동 원상 복구
- 빌드 로그 저장

5. 성공하면 GitHub Desktop에서 Commit 후 Push합니다.

추천 커밋:

```text
Fix Korean Shorts Studio integration
```

## 빌드 실패 시

프로젝트 폴더에 아래 형식의 로그가 남습니다.

```text
korean-shorts-v2-build-날짜시간.log
```

이번 V2는 자동 복구 코드도 수정했습니다. 이전 버전의 잘못된 `Select-Object -Reverse` 명령은 사용하지 않습니다.
