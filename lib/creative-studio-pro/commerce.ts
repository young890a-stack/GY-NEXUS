import OpenAI from "openai";
import { classifyOpenAIError, openAIUserError } from "@/lib/ai/openai-error";
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

const koreanSchema = {
  ...schema,
  properties: {
    ...schema.properties,
    platformVersions: {
      ...schema.properties.platformVersions,
      properties: {
        youtube: schema.properties.platformVersions.properties.youtube,
        instagram: schema.properties.platformVersions.properties.instagram,
      },
      required: ["youtube", "instagram"],
    },
  },
} as const;

const cleanStrings = (value: unknown, limit: number) =>
  Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, limit) : [];

const invalidProductFact = /access denied|forbidden|request blocked|접근이 거부|접근 거부|요청이 차단/i;

function verifiedFactsFromDescription(value: string) {
  if (!value.trim() || invalidProductFact.test(value)) return [];
  return value
    .split(/[\n.!?。！？]+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 2)
    .slice(0, 8);
}

function compactLength(value: string) {
  return value.replace(/\s/g, "").length;
}

function fitBodyToDuration(body: string, hooks: string[], durationSeconds: number) {
  const longestHook = hooks.reduce((longest, hook) => Math.max(longest, compactLength(hook)), 0);
  const bodyBudget = Math.max(24, Math.floor(durationSeconds * 5.2) - longestHook - 2);
  const normalized = body.replace(/\s+/g, " ").trim();
  if (compactLength(normalized) <= bodyBudget) return normalized;
  const words = normalized.split(" ");
  let fitted = "";
  for (const word of words) {
    const next = fitted ? `${fitted} ${word}` : word;
    if (compactLength(next) > bodyBudget) break;
    fitted = next;
  }
  if (!fitted) fitted = normalized.slice(0, bodyBudget);
  return fitted.replace(/[,\s]+$/g, "").replace(/[.!?。！？]?$/, ".");
}

function removeUnsupportedAccessClaims(value: string) {
  return value
    .replace(/쿠팡 판매 페이지와 제휴 링크가 제공되었습니다[.!?]?/gi, "")
    .replace(/한국 판매 페이지는 지역에 따라 접근성이 다를 수 있습니다[.!?]?/gi, "")
    .replace(/韩国(?:销售)?(?:页面|链接)[^。.!?]*(?:地区|访问|可用)[^。.!?]*[。.!?]?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function neutralizeUnsupportedModifiers(value: string) {
  return removeUnsupportedAccessClaims(value)
    .replace(/充电与电量更直观/gi, "充电状态与电量显示")
    .replace(/更(?:加)?直观/gi, "状态显示")
    .replace(/更(?:加)?清晰/gi, "信息显示")
    .replace(/更(?:加)?方便/gi, "可查看")
    .replace(/内置(?=\s*\d+\s*mAh)/gi, "")
    .replace(/더\s*직관적(?:으로|인)?/gi, "상태 표시")
    .replace(/더\s*(?:욱\s*)?편리(?:하게|한)?/gi, "확인 가능한")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const chineseAffiliateDisclosure = "本内容含联盟营销链接，如通过链接购买，我们可能获得佣金。";

function ensureChineseAffiliateDisclosure(value: string) {
  const text = neutralizeUnsupportedModifiers(value);
  if (/联盟营销|联盟链接|佣金|推广合作/.test(text)) return text;
  return `${text}${text ? "\n" : ""}${chineseAffiliateDisclosure}`;
}

function parseStructuredJson<T>(raw: string, label: string): T {
  const normalized = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? normalized.slice(start, end + 1) : normalized;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    throw new Error(`${label} JSON이 완성되지 않았습니다.`);
  }
}

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
  const allowedFacts = verifiedFactsFromDescription(input.productDescription);
  if (!allowedFacts.length) {
    throw new Error("광고 생성에 사용할 확인된 상품 설명이 없습니다. 차단 화면 문구가 아닌 실제 상품 정보를 입력해주세요.");
  }
  const platformTargets = new Set((input.platformTargets || ["youtube"]).map((item) => String(item).toLowerCase()));
  const koreanOnly = Array.from(platformTargets).every((target) => target === "youtube" || target === "instagram");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_FAST_MODEL || process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_QUALITY_MODEL || "gpt-5.6-sol";
  const requestPackage = (maxOutputTokens: number) => openai.responses.create({
    model,
    reasoning: { effort: "medium" },
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: [
          "당신은 GY-NEXUS의 한국 쇼핑 쇼츠 광고감독이다.",
          `상품명: ${input.productName}`,
          `검증된 상품 사실 목록: ${allowedFacts.join(" / ")}`,
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
          "검증 사실에 없는 '내장', '더 직관적', '더 편리', '더 선명' 같은 관계·비교·체감 표현을 추가하지 않는다. 중국어에서도 内置, 更直观, 更方便 같은 단어를 사실 목록에 없으면 쓰지 않는다.",
          "판매 페이지나 제휴 링크가 제공되었다는 사실을 verifiedClaims에 넣지 않는다. verifiedClaims에는 위 검증된 상품 사실 목록의 문장만 그대로 사용한다.",
          "직접 사용하지 않았다면 직접 써봤다는 표현을 금지한다. 상품 특징 소개의 관점으로 작성한다.",
          `voiceover는 선택형 훅을 제외한 본문 대본이다. 가장 긴 hookOptions 하나와 합친 전체 한국어 대본이 ${input.durationSeconds}초 안에 자연스럽게 읽히도록 충분히 짧게 작성한다.`,
          "썸네일 headline은 12자 안팎, accent는 8자 안팎으로 쓰고 과장된 99%, 무조건, 역대급 같은 문구는 금지한다.",
          `CTA는 쇼츠 설명 URL이 클릭되지 않을 수 있으므로 '프로필 링크의 상품 번호 ${input.productCode} 확인' 방식으로 작성한다.`,
          "description에는 상품 요약과 제휴 고지를 포함한다. 해시태그는 실제 상품과 관련된 것만 작성한다.",
          koreanOnly
            ? "한국형 쇼츠이므로 YouTube·Instagram용 한국어 버전만 만든다. 도우인·샤오홍슈 콘텐츠는 만들지 않는다."
            : "YouTube·Instagram용 한국어 버전, Douyin용 자연스러운 중국어 간체 버전, Xiaohongshu용 6~9장 사진 노트를 각각 만든다.",
          koreanOnly ? "" : "중국어 버전도 검증된 상품 사실만 번역한다. 한국 판매 페이지·링크의 제공 여부, 지역별 접근성이나 작동 여부를 언급하지 않는다.",
          koreanOnly ? "" : `도우인 caption과 샤오홍슈 body 각각에 다음 제휴 고지를 반드시 포함한다: ${chineseAffiliateDisclosure}`,
          koreanOnly ? "" : "샤오홍슈 카드 visualDirection은 제공된 상품 사진만으로 제작 가능한 확대·이동·배경·기능 강조 지시로 쓴다.",
        ].filter(Boolean).join("\n"),
      }],
    }],
    text: {
      format: {
        type: "json_schema",
        name: koreanOnly ? "gy_korean_commerce_package" : "gy_photo_commerce_package",
        strict: true,
        schema: koreanOnly ? koreanSchema : schema,
      },
    },
    max_output_tokens: maxOutputTokens,
  });

  let parsed: CommercePackage | null = null;
  let packageFailure: unknown = null;
  for (let attempt = 0; attempt < 2 && !parsed; attempt += 1) {
    try {
      const response = await requestPackage(koreanOnly ? (attempt === 0 ? 5200 : 7000) : (attempt === 0 ? 7000 : 9000));
      const raw = response.output_text?.trim();
      if (!raw) throw new Error("쇼핑 콘텐츠 패키지 결과가 비어 있습니다.");
      parsed = parseStructuredJson<CommercePackage>(raw, "쇼핑 콘텐츠 패키지");
    } catch (error) {
      const providerFailure = classifyOpenAIError(error);
      if (providerFailure && !providerFailure.retryable) throw providerFailure.userError;
      packageFailure = error;
    }
  }
  if (!parsed) {
    const providerFailure = openAIUserError(packageFailure);
    if (providerFailure) throw providerFailure;
    throw new Error(packageFailure instanceof Error
      ? `Dream Y가 잘린 AI 응답을 자동 재시도했지만 복구하지 못했습니다: ${packageFailure.message}`
      : "Dream Y가 쇼핑 콘텐츠 패키지를 자동 복구하지 못했습니다.");
  }
  const parsedDouyin = parsed.platformVersions.douyin || { title: "", caption: "", scriptSimplifiedChinese: "", hashtags: [] };
  const parsedXiaohongshu = parsed.platformVersions.xiaohongshu || { title: "", body: "", hashtags: [], cards: [] };
  const hookOptions = cleanStrings(parsed.hookOptions, 3).map(neutralizeUnsupportedModifiers);
  const voiceover = fitBodyToDuration(neutralizeUnsupportedModifiers(String(parsed.voiceover || "")), hookOptions, input.durationSeconds);
  const result: CommercePackage = {
    productCode: input.productCode,
    title: neutralizeUnsupportedModifiers(String(parsed.title || input.productName)),
    hookOptions,
    voiceover,
    description: neutralizeUnsupportedModifiers(String(parsed.description || "")),
    hashtags: cleanStrings(parsed.hashtags, 12).map((tag) => tag.startsWith("#") ? tag : `#${tag}`),
    disclosure: String(parsed.disclosure || "이 콘텐츠에는 제휴 링크가 포함될 수 있습니다.").trim(),
    cta: neutralizeUnsupportedModifiers(String(parsed.cta || "프로필 링크에서 해당 상품을 확인해보세요.")),
    thumbnailOptions: Array.isArray(parsed.thumbnailOptions) ? parsed.thumbnailOptions.slice(0, 3).map((option) => ({
      ...option,
      headline: neutralizeUnsupportedModifiers(option.headline),
      accent: neutralizeUnsupportedModifiers(option.accent),
    })) : [],
    verifiedClaims: allowedFacts,
    cautions: cleanStrings(parsed.cautions, 10).map(neutralizeUnsupportedModifiers),
    subtitleCues: createExactSubtitleCues(voiceover, input.durationSeconds),
    platformVersions: {
      youtube: {
        ...parsed.platformVersions.youtube,
        title: neutralizeUnsupportedModifiers(parsed.platformVersions.youtube.title),
        description: neutralizeUnsupportedModifiers(parsed.platformVersions.youtube.description),
        script: voiceover,
      },
      instagram: {
        ...parsed.platformVersions.instagram,
        caption: neutralizeUnsupportedModifiers(parsed.platformVersions.instagram.caption),
        script: voiceover,
      },
      douyin: {
        ...parsedDouyin,
        title: neutralizeUnsupportedModifiers(parsedDouyin.title),
        caption: koreanOnly ? "" : ensureChineseAffiliateDisclosure(parsedDouyin.caption),
        scriptSimplifiedChinese: neutralizeUnsupportedModifiers(parsedDouyin.scriptSimplifiedChinese),
      },
      xiaohongshu: {
        ...parsedXiaohongshu,
        title: neutralizeUnsupportedModifiers(parsedXiaohongshu.title),
        body: koreanOnly ? "" : ensureChineseAffiliateDisclosure(parsedXiaohongshu.body),
        cards: parsedXiaohongshu.cards.map((card) => ({
          ...card,
          headline: neutralizeUnsupportedModifiers(card.headline),
          body: neutralizeUnsupportedModifiers(card.body),
        })),
      },
    },
  };
  if (
    result.hookOptions.length !== 3
    || result.thumbnailOptions.length !== 3
    || !result.voiceover
    || !result.platformVersions?.youtube
    || (!koreanOnly && result.platformVersions.xiaohongshu.cards.length < 6)
  ) {
    throw new Error("쇼핑 콘텐츠 패키지 형식이 올바르지 않습니다.");
  }
  const auditModel = process.env.OPENAI_QUALITY_MODEL || model;
  const auditPlatformVersions: Record<string, unknown> = {};
  if (platformTargets.has("youtube")) auditPlatformVersions.youtube = result.platformVersions.youtube;
  if (platformTargets.has("instagram")) auditPlatformVersions.instagram = result.platformVersions.instagram;
  if (platformTargets.has("douyin")) auditPlatformVersions.douyin = result.platformVersions.douyin;
  if (platformTargets.has("xiaohongshu")) auditPlatformVersions.xiaohongshu = result.platformVersions.xiaohongshu;
  const auditContent = {
    ...result,
    platformVersions: auditPlatformVersions,
  };
  const requestAudit = (maxOutputTokens: number) => openai.responses.create({
    model: auditModel,
    reasoning: { effort: "high" },
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: [
          "당신은 GY-NEXUS의 독립 광고 품질검수자다.",
          `상품명: ${input.productName}`,
          `유일하게 허용된 상품 사실: ${allowedFacts.join(" / ")}`,
          `목표 길이: ${input.durationSeconds}초`,
          `검수 대상 게시 플랫폼: ${Array.from(platformTargets).join(", ")}`,
          `검수할 콘텐츠: ${JSON.stringify(auditContent)}`,
          "검수 대상 게시 플랫폼에 포함된 버전만 심사한다. 제공되지 않은 도우인·샤오홍슈 등 비대상 플랫폼 버전을 상상하거나 승인 판단에 포함하지 않는다.",
          "허용된 상품 사실로 직접 뒷받침되지 않는 가격, 수치, 효능, 비교우위, 후기, 사용 경험 표현은 모두 문제다.",
          "직접 사용했다는 표현, 확정적 성과, 과장 표현이 있으면 claimSafety 또는 directExperienceLanguage를 false로 한다.",
          "제휴 고지가 명확하지 않으면 affiliateDisclosure를 false로 한다.",
          `한국어 대본은 훅을 포함해 공백 제외 약 ${Math.floor(input.durationSeconds * 5.2)}자 이하이면 보통 속도로 읽을 수 있는 것으로 본다. 실제 합산 길이가 이 예산을 넘을 때만 durationFit을 false로 한다.`,
          "네 검수는 생성자의 자기평가와 독립적으로 보수적으로 수행한다.",
          "네 가지 check가 모두 true이고 중대한 문제가 없을 때만 approved를 true로 한다.",
        ].join("\n"),
      }],
    }],
    text: { format: { type: "json_schema", name: "gy_commerce_quality_audit", strict: true, schema: auditSchema } },
    max_output_tokens: maxOutputTokens,
  });
  let audit: CommerceQualityAudit | null = null;
  let auditFailure: unknown = null;
  for (let attempt = 0; attempt < 2 && !audit; attempt += 1) {
    try {
      const auditResponse = await requestAudit(attempt === 0 ? 2600 : 4000);
      const auditRaw = auditResponse.output_text?.trim();
      if (!auditRaw) throw new Error("쇼핑 콘텐츠 독립 품질검수 결과가 비어 있습니다.");
      audit = parseStructuredJson<CommerceQualityAudit>(auditRaw, "독립 품질검수");
    } catch (error) {
      const providerFailure = classifyOpenAIError(error);
      if (providerFailure && !providerFailure.retryable) throw providerFailure.userError;
      auditFailure = error;
    }
  }
  if (!audit) {
    const providerFailure = openAIUserError(auditFailure);
    if (providerFailure) throw providerFailure;
    throw new Error(auditFailure instanceof Error
      ? `Dream Y가 품질검수 응답을 자동 재시도했지만 복구하지 못했습니다: ${auditFailure.message}`
      : "Dream Y가 품질검수 응답을 자동 복구하지 못했습니다.");
  }
  audit.approved = Boolean(audit.approved) && Object.values(audit.checks).every(Boolean);
  audit.score = Math.max(0, Math.min(100, Number(audit.score) || 0));
  audit.issues = cleanStrings(audit.issues, 10);
  result.qualityAudit = audit;
  return { model, result };
}
