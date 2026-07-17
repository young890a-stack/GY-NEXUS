export type Platform = "coupang" | "temu" | "manual";

export type PipelineInput = {
  title: string;
  category?: string;
  platform?: Platform;
  priceText?: string;
  affiliateUrl?: string;
  targetAudience?: string;
  productFacts?: string[];
};

export type ThumbnailPlan = {
  concept: string;
  palette: string;
  composition: string;
  headline: string;
  ratio: "16:9" | "1:1";
  platformFit: string;
  qualityGate: string[];
};

function categoryTheme(category: string) {
  const value = category.toLowerCase();
  if (/태블릿|노트북|전자|it|스마트폰|이어폰/.test(value)) {
    return {
      concept: "신뢰감 있는 프리미엄 IT 리뷰형",
      palette: "네이비·블루·보라 계열의 깨끗한 기술 톤",
      composition: "제품을 중심에 크게 배치하고, 사용 장면과 핵심 장점 1개만 보조 요소로 사용",
    };
  }
  if (/청소|세탁|주방|생활|수납/.test(value)) {
    return {
      concept: "문제 해결이 한눈에 보이는 생활 개선형",
      palette: "밝은 아이보리·민트·하늘색 중심의 청결한 톤",
      composition: "사용 전후 또는 문제→해결 흐름을 한 장면에 단순하게 표현",
    };
  }
  if (/금융|재테크|투자|절세/.test(value)) {
    return {
      concept: "전문성과 신뢰를 강조한 금융 정보형",
      palette: "네이비·딥블루 기반에 금색 포인트",
      composition: "인물 또는 핵심 숫자 1개와 그래프 아이콘을 절제해 배치",
    };
  }
  return {
    concept: "상품 효용을 빠르게 이해시키는 실용 정보형",
    palette: "제품 색상과 대비되는 차분한 배경",
    composition: "상품·사용자·핵심 효용을 3요소 이내로 구성",
  };
}

export function createPipelinePlan(input: PipelineInput) {
  const category = input.category?.trim() || "생활·쇼핑";
  const audience = input.targetAudience?.trim() || "20~40대 실용 소비자";
  const theme = categoryTheme(category);
  const title = input.title.trim();
  const platform = input.platform || "manual";
  const facts = (input.productFacts || []).filter(Boolean).slice(0, 8);

  const confidence = Math.min(100, 55 + (input.affiliateUrl ? 15 : 0) + (input.priceText ? 10 : 0) + Math.min(20, facts.length * 4));
  const opportunityScore = Math.min(95, Math.round(62 + (facts.length * 3) + (input.affiliateUrl ? 7 : 0) + (/청소|전자|생활|태블릿|노트북/.test(category) ? 5 : 0)));

  const headline = title.length > 18 ? `${title.slice(0, 16)}… 핵심 정리` : `${title}, 왜 인기일까?`;
  const thumbnail: ThumbnailPlan = {
    concept: theme.concept,
    palette: theme.palette,
    composition: theme.composition,
    headline,
    ratio: "16:9",
    platformFit: "Blogger 대표 이미지와 YouTube 미리보기에 공통 활용하되, 모바일에서 3초 안에 읽히도록 문구를 12자 안팎으로 제한",
    qualityGate: [
      "상품명과 실제 제품 이미지가 일치할 것",
      "가격·할인율은 최신 확인 없이는 이미지에 넣지 않을 것",
      "문구는 핵심 메시지 1개만 사용할 것",
      "모바일 축소 화면에서도 제목이 읽힐 것",
      "과장된 효능·판매량·후기 표현을 사용하지 않을 것",
    ],
  };

  return {
    version: "2.0-sprint-1",
    status: confidence >= 75 ? "READY_FOR_REVIEW" : "NEEDS_MORE_DATA",
    product: { title, category, platform, priceText: input.priceText || "미입력", affiliateUrl: input.affiliateUrl || "미연결", audience },
    scores: {
      opportunity: opportunityScore,
      dataConfidence: confidence,
      contentFit: Math.min(96, opportunityScore + 2),
      thumbnailFit: Math.min(94, opportunityScore),
    },
    reasons: [
      `${audience} 대상의 문제 해결형 콘텐츠로 전개하기 적합합니다.`,
      facts.length ? `검증 가능한 상품 사실 ${facts.length}개를 콘텐츠 근거로 사용할 수 있습니다.` : "상품 사실 정보가 부족하므로 생성 전에 상세정보 보강이 필요합니다.",
      input.affiliateUrl ? "제휴 링크가 있어 클릭 추적 파이프라인에 연결할 수 있습니다." : "제휴 링크가 없어 게시 단계는 잠금 상태로 유지해야 합니다.",
    ],
    contentPlan: {
      blog: {
        angle: "구매를 재촉하지 않고 문제·사용 상황·선택 기준·주의사항을 설명하는 정보형 글",
        sections: ["문제 상황", "제품이 해결하는 방식", "핵심 기능과 실제 사용 포인트", "구매 전 확인사항", "대안과 적합한 사용자", "제휴 고지와 결론"],
      },
      shorts: {
        duration: 22,
        structure: ["0~3초 문제 훅", "4~13초 사용 장면과 핵심 효용", "14~19초 주의사항 또는 선택 기준", "20~22초 자연스러운 CTA"],
        subtitle: "AI 검수된 정확한 한국어 SRT를 생성하고 CapCut 자동 자막은 사용하지 않음",
      },
      thumbnail,
    },
    gates: {
      collect: platform === "manual" ? "MANUAL_SOURCE" : "CONNECTOR_REQUIRED",
      analyze: confidence >= 60 ? "PASS" : "HOLD",
      generate: confidence >= 75 ? "PASS_AFTER_OWNER_APPROVAL" : "HOLD",
      publish: input.affiliateUrl ? "OWNER_APPROVAL_REQUIRED" : "LOCKED_NO_AFFILIATE_URL",
    },
  };
}
