import OpenAI from "openai";

export type CommerceThumbnailOption = {
  headline: string;
  accent: string;
  layout: "benefit-arrow" | "problem-solution" | "clean-product";
};

export type CommercePackage = {
  title: string;
  hookOptions: string[];
  voiceover: string;
  description: string;
  hashtags: string[];
  disclosure: string;
  cta: string;
  thumbnailOptions: CommerceThumbnailOption[];
  verifiedClaims: string[];
  cautions: string[];
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    hookOptions: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    voiceover: { type: "string" },
    description: { type: "string" },
    hashtags: { type: "array", minItems: 6, maxItems: 12, items: { type: "string" } },
    disclosure: { type: "string" },
    cta: { type: "string" },
    thumbnailOptions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          headline: { type: "string" },
          accent: { type: "string" },
          layout: { type: "string", enum: ["benefit-arrow", "problem-solution", "clean-product"] },
        },
        required: ["headline", "accent", "layout"],
      },
    },
    verifiedClaims: { type: "array", items: { type: "string" } },
    cautions: { type: "array", items: { type: "string" } },
  },
  required: [
    "title",
    "hookOptions",
    "voiceover",
    "description",
    "hashtags",
    "disclosure",
    "cta",
    "thumbnailOptions",
    "verifiedClaims",
    "cautions",
  ],
} as const;

const cleanStrings = (value: unknown, limit: number) =>
  Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, limit) : [];

export async function generateCommercePackage(input: {
  productName: string;
  productDescription: string;
  durationSeconds: number;
  style: string;
  productUrl?: string;
  affiliateUrl?: string;
  platformTargets?: string[];
  sceneNarrations?: string[];
}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_QUALITY_MODEL || "gpt-5.6-sol";
  const response = await openai.responses.create({
    model,
    reasoning: { effort: "high" },
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: [
          "당신은 GY-NEXUS의 한국 쇼핑 쇼츠 광고감독이다.",
          `상품명: ${input.productName}`,
          `검증된 상품 설명: ${input.productDescription || "확인된 설명 없음"}`,
          `영상 길이: ${input.durationSeconds}초`,
          `연출 스타일: ${input.style}`,
          `게시 대상: ${(input.platformTargets || ["youtube"]).join(", ")}`,
          `판매 페이지: ${input.productUrl || "미입력"}`,
          `제휴 링크: ${input.affiliateUrl ? "연결됨" : "미연결"}`,
          `현재 장면 대사: ${(input.sceneNarrations || []).join(" / ") || "없음"}`,
          "대상은 한국의 20~40대다. 첫 2초에 구체적인 문제 또는 결과를 제시한다.",
          "상품 설명에서 확인된 사실만 장점으로 말하고 가격, 할인율, 성능 수치나 사용 후기를 추측하지 않는다.",
          "직접 사용하지 않았다면 직접 써봤다는 표현을 금지한다. 상품 특징 소개의 관점으로 작성한다.",
          "voiceover는 지정된 길이에 자연스럽게 읽을 수 있는 하나의 완성 대본으로 작성한다.",
          "썸네일 headline은 12자 안팎, accent는 8자 안팎으로 쓰고 과장된 99%, 무조건, 역대급 같은 문구는 금지한다.",
          "CTA는 쇼츠 설명 URL이 클릭되지 않을 수 있으므로 '프로필 링크의 상품 번호 확인' 방식으로 작성한다.",
          "description에는 상품 요약과 제휴 고지를 포함한다. 해시태그는 실제 상품과 관련된 것만 작성한다.",
        ].join("\n"),
      }],
    }],
    text: {
      format: {
        type: "json_schema",
        name: "gy_photo_commerce_package",
        strict: true,
        schema,
      },
    },
    max_output_tokens: 2800,
  });

  const raw = response.output_text?.trim();
  if (!raw) throw new Error("쇼핑 콘텐츠 패키지 결과가 비어 있습니다.");
  const parsed = JSON.parse(raw) as CommercePackage;
  const result: CommercePackage = {
    title: String(parsed.title || input.productName).trim(),
    hookOptions: cleanStrings(parsed.hookOptions, 3),
    voiceover: String(parsed.voiceover || "").trim(),
    description: String(parsed.description || "").trim(),
    hashtags: cleanStrings(parsed.hashtags, 12).map((tag) => tag.startsWith("#") ? tag : `#${tag}`),
    disclosure: String(parsed.disclosure || "이 콘텐츠에는 제휴 링크가 포함될 수 있습니다.").trim(),
    cta: String(parsed.cta || "프로필 링크에서 해당 상품을 확인해보세요.").trim(),
    thumbnailOptions: Array.isArray(parsed.thumbnailOptions) ? parsed.thumbnailOptions.slice(0, 3) : [],
    verifiedClaims: cleanStrings(parsed.verifiedClaims, 10),
    cautions: cleanStrings(parsed.cautions, 10),
  };
  if (result.hookOptions.length !== 3 || result.thumbnailOptions.length !== 3 || !result.voiceover) {
    throw new Error("쇼핑 콘텐츠 패키지 형식이 올바르지 않습니다.");
  }
  return { model, result };
}
