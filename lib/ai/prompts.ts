export type ContentKind = "blog" | "shorts" | "bundle";

type PromptInput = {
  kind: ContentKind;
  title: string;
  description?: string;
};

export function buildPrompt({ kind, title, description }: PromptInput) {
  const productInfo = `상품명: ${title}\n상품 설명: ${description || "상품 설명 없음"}`;

  if (kind === "blog") {
    return `너는 제휴마케팅과 네이버 블로그 SEO 전문 작가야.\n\n${productInfo}\n\n아래 조건으로 완성된 블로그 글만 작성해줘.\n- SEO 제목 1개\n- 약 2,000자 이상의 자연스러운 정보형·후기형 본문\n- 실제 사용하지 않은 경험을 사실처럼 단정하지 않기\n- 주요 특징, 활용 상황, 추천 대상, 구매 전 확인점 포함\n- 과장 광고와 허위 긴급성 금지\n- 마지막에 자연스러운 행동 유도 문장\n- 다음 고지 문구 포함: 이 글은 제휴마케팅 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.\n- 관련 해시태그 15개`;
  }

  if (kind === "shorts") {
    return `너는 20~40대 대상 유튜브 쇼츠와 인스타 릴스 광고 기획 전문가야.\n\n${productInfo}\n\n아래 순서로 완성본만 작성해줘.\n1. 쇼츠 제목 5개\n2. 15초 장면 구성: 0~3초 훅, 4~7초 필요성, 8~11초 특징, 12~15초 CTA\n3. 15초 음성 대본 한 문단\n4. 캡컷 AI 영상 생성용 통합 프롬프트\n5. 썸네일 문구 5개\n6. 업로드 설명과 제휴마케팅 고지\n7. 해시태그 15개\n\n필수 조건: 세로형 9:16, 자막 없음, 화면 텍스트 없음, 로고 추가 없음, 워터마크 없음, 제품에 없는 부품 추가 금지, 실제 제품 형태와 기능 유지, 과장 금지.`;
  }

  return `너는 제휴마케팅 콘텐츠 전략가야.\n\n${productInfo}\n\n다음 패키지를 완성본으로 작성해줘.\n1. SEO 제목 5개\n2. 네이버 블로그 글\n3. 15초 쇼츠 장면 구성과 음성 대본\n4. 인스타그램 게시물\n5. 썸네일 문구 5개\n6. 해시태그 20개\n7. 제휴마케팅 고지 문구\n과장하거나 상품 설명에 없는 기능을 만들지 마.`;
}
