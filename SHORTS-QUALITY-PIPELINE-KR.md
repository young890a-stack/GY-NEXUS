# GY-NEXUS 프리미엄 쇼츠 이미지 품질 V4

## V4에서 강화된 핵심

1. 실제 상품 사진을 서로 다른 각도로 **2~4장** 받아야 제작을 시작합니다.
2. 첫 이미지 생성 전에 GPT-5.6 Sol이 상품의 색상, 재질, 실루엣, 버튼, 포트, 로고와 구성품을 `Product Visual DNA`로 고정합니다.
3. GPT Image 2가 각 장면마다 **중간 품질 후보 3개**를 만들고 서로 비교합니다.
4. 평균점수뿐 아니라 상품 동일성, 전체 무결성, 형태·버튼, 색상·재질, 로고·글자, 손·신체, 장면 연속성, 영상 안정성, 자연스러움, 구도, 과장 위험을 각각 검사합니다.
5. 가짜 글자·변형 로고·추가 버튼이나 포트·손가락 오류·제품 변형은 `치명적 오류`로 처리해 평균점수와 관계없이 탈락시킵니다.
6. 직전 승인 이미지를 다음 장면의 연속성 기준으로 사용해 상품, 인물, 조명과 색감이 장면마다 바뀌는 현상을 줄입니다.
7. 통과 후보만 GPT Image 2 **4K 세로형 고품질 최종본**으로 다시 만들고 동일한 기준으로 재검수합니다.
8. Runway에는 승인 이미지와 제품 변형 방지용 모션 프롬프트만 전달합니다. 빠른 회전, 급격한 줌, 제품이 녹는 효과와 불필요한 입자를 차단합니다.
9. 모든 이미지가 통과하고 대표가 비용을 승인해야 Runway 크레딧이 사용됩니다.
10. 완성 후 정확한 한국어 SRT, CapCut 안내서와 편집 JSON을 내려받습니다. CapCut 자동 자막은 사용하지 않습니다.

## 비용과 품질 기준

- 초안은 기존 `low`에서 `medium`으로 높였습니다.
- 최종 이미지는 기본 `2160x3840`, `high` 품질입니다.
- 기준 미달 장면은 최대 2회만 재생성한 뒤 보류합니다.
- 보류 장면에는 Runway 비용을 사용하지 않습니다.
- AI 생성물은 판매 전에 대표가 최종 상품 일치 여부를 확인해야 합니다.

GPT Image 2는 참조 이미지 편집 입력을 항상 높은 충실도로 처리하며 2160x3840 세로 출력을 지원합니다.

공식 문서: https://developers.openai.com/api/docs/guides/image-generation

## 배포 전 확인

### 1. Supabase SQL

이전 버전에서 아직 실행하지 않았다면 Supabase `SQL Editor`에서 다음 파일 전체를 실행합니다.

`supabase/SHORTS-QUALITY-PIPELINE-MIGRATION.sql`

이미 실행했다면 다시 할 필요가 없습니다. SQL에 `if not exists`가 적용되어 있어 헷갈리면 한 번 더 실행해도 기존 데이터는 삭제되지 않습니다. V4는 새 데이터베이스 열을 요구하지 않습니다.

### 2. Vercel 환경변수

다음 값이 운영 프로젝트 `gy-nexus-zfpq`의 Production과 Preview에 이미 있으면 V4에서 추가할 것은 없습니다.

```env
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_QUALITY_MODEL=gpt-5.6-sol
SHORTS_QUALITY_THRESHOLD=85
SHORTS_MAX_IMAGE_RETRIES=2
RUNWAY_VIDEO_MODEL=gen4.5
```

`OPENAI_API_KEY`, `RUNWAYML_API_SECRET`, Supabase 키는 기존 값을 유지합니다. Vercel 토큰과 `npm run vercel:setup`은 사용하지 않습니다.

### 3. 전체 덮어쓰기와 배포

V4 ZIP을 기존 `GY-NEXUS` 폴더에 전체 덮어쓴 뒤 PowerShell에서 실행합니다.

```powershell
npm ci
npm run build
git add .
git commit -m "Strengthen premium shorts image fidelity"
git push origin main
```

`nothing to commit`이 나오면 `git push origin main`만 실행합니다. GitHub `main`에 새 커밋이 올라가면 Vercel이 자동 재배포합니다.

## 실제 사용 순서

1. `AI Factory → Creative Studio Pro`를 엽니다.
2. 확인된 상품명과 상품 설명을 입력합니다.
3. 상품의 앞·뒤·측면처럼 서로 다른 각도의 실제 사진을 2~4장 올립니다.
4. 프로젝트를 만든 뒤 `전체 이미지 검수`를 누릅니다.
5. `Product Visual DNA`의 참고자료 점수와 누락 각도를 확인합니다.
6. 장면별 치명적 오류와 11개 품질 지표를 확인합니다.
7. 모든 장면이 통과했을 때만 `Runway 비용 승인`을 누릅니다.
8. `남은 영상 모두 생성`을 누릅니다.
9. CapCut에 장면 MP4와 제공된 SRT를 넣고 효과음, 짧은 전환과 색보정만 마무리합니다.

## 좋은 상품 사진 기준

- 같은 실제 상품을 밝은 곳에서 촬영합니다.
- 앞면, 뒷면, 측면 또는 포트·버튼이 잘 보이는 사진을 포함합니다.
- 상품을 손으로 너무 많이 가리지 않습니다.
- 필터, 워터마크, 가격 문구와 큰 자막이 없는 원본을 사용합니다.
- 서로 다른 색상이나 다른 모델의 상품 사진을 섞지 않습니다.

## 배포 후 1회 점검

- 사진 1장만 넣었을 때 제작이 차단되는지
- 사진 2~4장으로 Product Visual DNA가 표시되는지
- 후보 3개와 11개 품질 지표가 표시되는지
- 치명적 오류가 있는 후보가 점수와 관계없이 탈락하는지
- 직전 장면과 상품·조명·색감이 이어지는지
- 모든 이미지 통과 전 Runway 승인 버튼이 잠기는지
- SRT의 한국어와 장면 시간이 정확한지

외부 OpenAI·Runway 실사용 테스트는 실제 API 비용이 발생하므로 자동 검증에서 실행하지 않았습니다.
