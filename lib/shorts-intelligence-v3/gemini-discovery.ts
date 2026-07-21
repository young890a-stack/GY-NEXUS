import { GoogleGenAI } from "@google/genai";

export type DiscoveryIntent = "product" | "problem" | "use-case" | "review" | "comparison" | "viral" | "purchase";

export type DiscoveryKeyword = {
  simplifiedChinese: string;
  koreanMeaning: string;
  intent: DiscoveryIntent;
  priority: number;
};

export type GeminiKeywordPlan = {
  translatedProductName: string;
  keywords: DiscoveryKeyword[];
  sellingAngles: string[];
  cautions: string[];
};

export type CandidateTriageResult = {
  id: string;
  relevanceScore: number;
  visualSellabilityScore: number;
  hookPotentialScore: number;
  riskScore: number;
  summary: string;
  hookPattern: string;
  sellingAngle: string;
  riskFlags: string[];
  recommended: boolean;
};

const keywordSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    translatedProductName: { type: "string" },
    keywords: {
      type: "array",
      minItems: 12,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          simplifiedChinese: { type: "string" },
          koreanMeaning: { type: "string" },
          intent: { type: "string", enum: ["product", "problem", "use-case", "review", "comparison", "viral", "purchase"] },
          priority: { type: "integer" },
        },
        required: ["simplifiedChinese", "koreanMeaning", "intent", "priority"],
      },
    },
    sellingAngles: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
    cautions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
  },
  required: ["translatedProductName", "keywords", "sellingAngles", "cautions"],
} as const;

const triageSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          relevanceScore: { type: "integer" },
          visualSellabilityScore: { type: "integer" },
          hookPotentialScore: { type: "integer" },
          riskScore: { type: "integer" },
          summary: { type: "string" },
          hookPattern: { type: "string" },
          sellingAngle: { type: "string" },
          riskFlags: { type: "array", items: { type: "string" }, maxItems: 8 },
          recommended: { type: "boolean" },
        },
        required: ["id", "relevanceScore", "visualSellabilityScore", "hookPotentialScore", "riskScore", "summary", "hookPattern", "sellingAngle", "riskFlags", "recommended"],
      },
    },
  },
  required: ["candidates"],
} as const;

export function getGeminiDiscoveryApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || "";
}

export function getGeminiDiscoveryModel() {
  return process.env.GEMINI_DISCOVERY_MODEL?.trim() || "gemini-3.5-flash";
}

export function clampScore(value: unknown) {
  const number = Math.round(Number(value) || 0);
  return Math.min(100, Math.max(0, number));
}

function cleanText(value: unknown, max: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function validateKeywordPlan(value: unknown): GeminiKeywordPlan {
  const input = value as Partial<GeminiKeywordPlan>;
  const keywords = Array.isArray(input?.keywords) ? input.keywords.flatMap((item) => {
    const keyword = item as Partial<DiscoveryKeyword>;
    const simplifiedChinese = cleanText(keyword.simplifiedChinese, 40);
    if (!simplifiedChinese || /[\p{Script=Hangul}]/u.test(simplifiedChinese)) return [];
    const allowed: DiscoveryIntent[] = ["product", "problem", "use-case", "review", "comparison", "viral", "purchase"];
    const intent = allowed.includes(keyword.intent as DiscoveryIntent) ? keyword.intent as DiscoveryIntent : "product";
    return [{
      simplifiedChinese,
      koreanMeaning: cleanText(keyword.koreanMeaning, 100),
      intent,
      priority: Math.min(100, Math.max(1, Math.round(Number(keyword.priority) || 50))),
    }];
  }) : [];
  const unique = Array.from(new Map(keywords.map((item) => [item.simplifiedChinese, item])).values()).slice(0, 20);
  if (unique.length < 12) throw new Error("중국어 검색어가 12개보다 적습니다.");
  const translatedProductName = cleanText(input?.translatedProductName, 80);
  if (!translatedProductName || /[\p{Script=Hangul}]/u.test(translatedProductName)) {
    throw new Error("정확한 중국어 간체 상품명이 필요합니다.");
  }
  return {
    translatedProductName,
    keywords: unique,
    sellingAngles: Array.isArray(input?.sellingAngles) ? input.sellingAngles.map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 8) : [],
    cautions: Array.isArray(input?.cautions) ? input.cautions.map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 8) : [],
  };
}

export function keywordPlanManualPrompt(query: string) {
  return [
    "당신은 GY-NEXUS의 중국 쇼츠 상품 발견 분석가다.",
    `한국 상품명: ${query}`,
    "도우인과 샤오홍슈에서 실제 사용자가 검색할 중국어 간체 검색어를 12~20개 만든다.",
    "상품명, 문제, 사용상황, 후기, 비교, 바이럴, 구매의도를 균형 있게 포함한다.",
    "브랜드, 효능, 판매량, 인기 수치를 만들지 않는다.",
    "아래 JSON 형태만 출력한다.",
    JSON.stringify({
      translatedProductName: "정확한 중국어 간체 상품명",
      keywords: [{ simplifiedChinese: "검색어", koreanMeaning: "한국어 뜻", intent: "product", priority: 90 }],
      sellingAngles: ["판매 관점"],
      cautions: ["과장 또는 상품 불일치 주의점"],
    }, null, 2),
  ].join("\n");
}

export async function generateKeywordPlanWithGemini(query: string): Promise<GeminiKeywordPlan> {
  const apiKey = getGeminiDiscoveryApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  const client = new GoogleGenAI({ apiKey });
  const interaction = await client.interactions.create({
    model: getGeminiDiscoveryModel(),
    system_instruction: "중국 숏폼 플랫폼의 자연스러운 검색어만 설계한다. 확인되지 않은 수치나 효능을 만들지 않는다.",
    input: keywordPlanManualPrompt(query),
    response_format: { type: "text", mime_type: "application/json", schema: keywordSchema },
  });
  return validateKeywordPlan(JSON.parse(interaction.output_text || "{}"));
}

export function candidateTriageManualPrompt(productQuery: string, candidates: Array<Record<string, unknown>>) {
  return [
    "당신은 GY-NEXUS의 중국 쇼츠 1차 선별 분석가다.",
    `대상 상품: ${productQuery}`,
    "아래 후보는 공개 카드 메타데이터다. 영상 원본을 보았다고 주장하지 않는다.",
    "제목, 공개 반응 수치, 검색순위, 반복노출을 근거로 관련성·판매장면 가능성·훅 가능성·위험을 0~100으로 평가한다.",
    "워터마크, 권리 미확인, 상품 불일치, 과장 가능성을 위험에 포함한다.",
    "아래 모든 id를 한 번씩 포함한 JSON만 출력한다.",
    JSON.stringify({ candidates: candidates.map((item) => ({
      id: item.id,
      relevanceScore: 0,
      visualSellabilityScore: 0,
      hookPotentialScore: 0,
      riskScore: 0,
      summary: "",
      hookPattern: "",
      sellingAngle: "",
      riskFlags: [],
      recommended: false,
    })) }, null, 2),
    "후보 데이터:",
    JSON.stringify(candidates, null, 2),
  ].join("\n");
}

export async function triageCandidatesWithGemini(productQuery: string, candidates: Array<Record<string, unknown>>): Promise<CandidateTriageResult[]> {
  const apiKey = getGeminiDiscoveryApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  const client = new GoogleGenAI({ apiKey });
  const interaction = await client.interactions.create({
    model: getGeminiDiscoveryModel(),
    system_instruction: "공개 카드 메타데이터만 평가한다. 영상이나 성과를 보지 않았다면 보았다고 주장하지 않는다.",
    input: candidateTriageManualPrompt(productQuery, candidates),
    response_format: { type: "text", mime_type: "application/json", schema: triageSchema },
  });
  const parsed = JSON.parse(interaction.output_text || "{}") as { candidates?: CandidateTriageResult[] };
  const allowedIds = new Set(candidates.map((item) => String(item.id)));
  return (Array.isArray(parsed.candidates) ? parsed.candidates : []).flatMap((item) => {
    const id = String(item.id || "");
    if (!allowedIds.has(id)) return [];
    return [{
      id,
      relevanceScore: clampScore(item.relevanceScore),
      visualSellabilityScore: clampScore(item.visualSellabilityScore),
      hookPotentialScore: clampScore(item.hookPotentialScore),
      riskScore: clampScore(item.riskScore),
      summary: cleanText(item.summary, 300),
      hookPattern: cleanText(item.hookPattern, 160),
      sellingAngle: cleanText(item.sellingAngle, 160),
      riskFlags: Array.isArray(item.riskFlags) ? item.riskFlags.map((value) => cleanText(value, 100)).filter(Boolean).slice(0, 8) : [],
      recommended: Boolean(item.recommended),
    }];
  });
}
