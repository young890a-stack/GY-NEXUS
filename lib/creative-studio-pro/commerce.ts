import OpenAI from "openai";
import type { TrendIntelligence } from "@/lib/creative-studio-pro/integration";

export type CommerceThumbnailOption = {
  headline: string;
  accent: string;
  layout: "benefit-arrow" | "problem-solution" | "clean-product";
};

export type CommerceQualityAudit = {
  approved: boolean;
  score: number;
  summary: string;
  issues: string[];
  checks: {
    claimSafety: boolean;
    affiliateDisclosure: boolean;
    directExperienceLanguage: boolean;
    durationFit: boolean;
  };
};

export type CommercePackage = {
  productCode: string;
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
  subtitleCues: Array<{ index: number; startSecond: number; endSecond: number; text: string }>;
  qualityAudit?: CommerceQualityAudit;
  platformVersions: {
    youtube: { title: string; description: string; script: string; hashtags: string[] };
    instagram: { caption: string; script: string; hashtags: string[] };
    douyin: { title: string; caption: string; scriptSimplifiedChinese: string; hashtags: string[] };
    xiaohongshu: {
      title: string;
      body: string;
      hashtags: string[];
      cards: Array<{ order: number; headline: string; body: string; visualDirection: string }>;
    };
  };
};

const auditSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    approved: { type: "boolean" },
    score: { type: "number", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    issues: { type: "array", maxItems: 10, items: { type: "string" } },
    checks: {
      type: "object",
      additionalProperties: false,
      properties: {
        claimSafety: { type: "boolean" },
        affiliateDisclosure: { type: "boolean" },
        directExperienceLanguage: { type: "boolean" },
        durationFit: { type: "boolean" },
      },
      required: ["claimSafety", "affiliateDisclosure", "directExperienceLanguage", "durationFit"],
    },
  },
  required: ["approved", "score", "summary", "issues", "checks"],
} as const;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    productCode: { type: "string" },
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
    platformVersions: {
      type: "object",
      additionalProperties: false,
      properties: {
        youtube: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            script: { type: "string" },
            hashtags: { type: "array", minItems: 4, maxItems: 10, items: { type: "string" } },
          },
          required: ["title", "description", "script", "hashtags"],
        },
        instagram: {
          type: "object",
          additionalProperties: false,
          properties: {
            caption: { type: "string" },
            script: { type: "string" },
            hashtags: { type: "array", minItems: 4, maxItems: 12, items: { type: "string" } },
          },
          required: ["caption", "script", "hashtags"],
        },
        douyin: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            caption: { type: "string" },
            scriptSimplifiedChinese: { type: "string" },
            hashtags: { type: "array", minItems: 4, maxItems: 10, items: { type: "string" } },
          },
          required: ["title", "caption", "scriptSimplifiedChinese", "hashtags"],
        },
        xiaohongshu: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            hashtags: { type: "array", minItems: 4, maxItems: 10, items: { type: "string" } },
            cards: {
              type: "array",
              minItems: 6,
              maxItems: 9,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  order: { type: "integer" },
                  headline: { type: "string" },
                  body: { type: "string" },
                  visualDirection: { type: "string" },
                },
                required: ["order", "headline", "body", "visualDirection"],
              },
            },
          },
          required: ["title", "body", "hashtags", "cards"],
        },
      },
      required: ["youtube", "instagram", "douyin", "xiaohongshu"],
    },
  },
  required: [
    "productCode",
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
    "platformVersions",
  ],
} as const;

const cleanStrings = (value: unknown, limit: number) =>
  Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, limit) : [];

export function createExactSubtitleCues(script: string, durationSeconds: number) {
  const words = script.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [];
  const desiredCueCount = Math.max(1, Math.min(10, Math.round(durationSeconds / 3)));
  const targetCharacters = Math.max(8, Math.ceil(script.length / desiredCueCount));
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > targetCharacters && chunks.length < desiredCueCount - 1) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  const weights = chunks.map((chunk) => Math.max(1, chunk.replace(/\s/g, "").length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return chunks.map((text, index) => {
    const startSecond = Number(cursor.toFixed(2));
    cursor = index === chunks.length - 1
      ? durationSeconds
      : cursor + (durationSeconds * weights[index] / totalWeight);
    return { index: index + 1, startSecond, endSecond: Number(cursor.toFixed(2)), text };
  });
}

export async function generateCommercePackage(input: {
  productName: string;
  productDescription: string;
  durationSeconds: number;
  style: string;
  productUrl?: string;
  affiliateUrl?: string;
  platformTargets?: string[];
  sceneNarrations?: string[];
  productCode: string;
  trendIntelligence?: TrendIntelligence;
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
          `GY 쇼핑 진열장 상품번호: ${input.productCode}`,
          `현재 장면 대사: ${(input.sceneNarrations || []).join(" / ") || "없음"}`,
          `중국 탐색 키워드: ${(input.trendIntelligence?.chineseKeywords || []).map((item) => item.simplifiedChinese).join(", ") || "없음"}`,
          `독창적 판매 각도: ${(input.trendIntelligence?.sellingAngles || []).join(" / ") || "없음"}`,
          "대상은 한국의 20~40대다. 첫 2초에 구체적인 문제 또는 결과를 제시한다.",
          "상품 설명에서 확인된 사실만 장점으로 말하고 가격, 할인율, 성능 수치나 사용 후기를 추측하지 않는다.",
          "직접 사용하지 않았다면 직접 써봤다는 표현을 금지한다. 상품 특징 소개의 관점으로 작성한다.",
          "voiceover는 선택형 훅을 제외한 본문 대본이다. hookOptions 중 하나를 앞에 붙여도 지정 길이에 자연스럽게 읽히도록 짧게 작성한다.",
          "썸네일 headline은 12자 안팎, accent는 8자 안팎으로 쓰고 과장된 99%, 무조건, 역대급 같은 문구는 금지한다.",
          `CTA는 쇼츠 설명 URL이 클릭되지 않을 수 있으므로 '프로필 링크의 상품 번호 ${input.productCode} 확인' 방식으로 작성한다.`,
          "description에는 상품 요약과 제휴 고지를 포함한다. 해시태그는 실제 상품과 관련된 것만 작성한다.",
          "YouTube·Instagram용 한국어 버전, Douyin용 자연스러운 중국어 간체 버전, Xiaohongshu용 6~9장 사진 노트를 각각 만든다.",
          "중국어 버전도 검증된 상품 사실만 번역하며 한국 판매 링크가 중국에서 작동한다고 가정하지 않는다.",
          "샤오홍슈 카드 visualDirection은 제공된 상품 사진만으로 제작 가능한 확대·이동·배경·기능 강조 지시로 쓴다.",
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
    max_output_tokens: 6000,
  });

  const raw = response.output_text?.trim();
  if (!raw) throw new Error("쇼핑 콘텐츠 패키지 결과가 비어 있습니다.");
  const parsed = JSON.parse(raw) as CommercePackage;
  const result: CommercePackage = {
    productCode: input.productCode,
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
    subtitleCues: createExactSubtitleCues(String(parsed.voiceover || "").trim(), input.durationSeconds),
    platformVersions: parsed.platformVersions,
  };
  if (
    result.hookOptions.length !== 3
    || result.thumbnailOptions.length !== 3
    || !result.voiceover
    || !result.platformVersions?.youtube
    || result.platformVersions.xiaohongshu.cards.length < 6
  ) {
    throw new Error("쇼핑 콘텐츠 패키지 형식이 올바르지 않습니다.");
  }
  const auditResponse = await openai.responses.create({
    model,
    reasoning: { effort: "high" },
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: [
          "당신은 GY-NEXUS의 독립 광고 품질검수자다.",
          `상품명: ${input.productName}`,
          `유일하게 허용된 상품 사실: ${input.productDescription || "없음"}`,
          `목표 길이: ${input.durationSeconds}초`,
          `검수할 콘텐츠: ${JSON.stringify(result)}`,
          "허용된 상품 사실로 직접 뒷받침되지 않는 가격, 수치, 효능, 비교우위, 후기, 사용 경험 표현은 모두 문제다.",
          "직접 사용했다는 표현, 확정적 성과, 과장 표현이 있으면 claimSafety 또는 directExperienceLanguage를 false로 한다.",
          "제휴 고지가 명확하지 않으면 affiliateDisclosure를 false로 한다.",
          "한국어 본문 대본 앞에 짧은 훅 하나를 더했을 때 목표 길이에 읽기 어려우면 durationFit을 false로 한다.",
          "네 검수는 생성자의 자기평가와 독립적으로 보수적으로 수행한다.",
          "네 가지 check가 모두 true이고 중대한 문제가 없을 때만 approved를 true로 한다.",
        ].join("\n"),
      }],
    }],
    text: { format: { type: "json_schema", name: "gy_commerce_quality_audit", strict: true, schema: auditSchema } },
    max_output_tokens: 2200,
  });
  const auditRaw = auditResponse.output_text?.trim();
  if (!auditRaw) throw new Error("쇼핑 콘텐츠 독립 품질검수 결과가 비어 있습니다.");
  const audit = JSON.parse(auditRaw) as CommerceQualityAudit;
  audit.approved = Boolean(audit.approved) && Object.values(audit.checks).every(Boolean);
  audit.score = Math.max(0, Math.min(100, Number(audit.score) || 0));
  audit.issues = cleanStrings(audit.issues, 10);
  result.qualityAudit = audit;
  return { model, result };
}
