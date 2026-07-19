import OpenAI from "openai";

export type MediaPlatform = "douyin" | "xiaohongshu" | "coupang" | "temu" | "owned" | "other";
export type MediaRightsStatus =
  | "owned"
  | "seller-provided"
  | "affiliate-provided"
  | "permission-confirmed"
  | "unverified";

export type MediaReference = {
  id: string;
  platform: MediaPlatform;
  url: string;
  title: string;
  rightsStatus: MediaRightsStatus;
  useInFinal: boolean;
  notes: string;
  createdAt: string;
};

export type TrendKeyword = {
  simplifiedChinese: string;
  koreanMeaning: string;
  searchIntent: string;
};

export type TrendShot = {
  order: number;
  durationSeconds: number;
  role: string;
  camera: string;
  direction: string;
  assetType: "photo" | "licensed-video" | "generated-scene";
};

export type TrendIntelligence = {
  chineseKeywords: TrendKeyword[];
  discoveryLinks: Array<{
    platform: "douyin" | "xiaohongshu";
    keyword: string;
    url: string;
  }>;
  hookPatterns: string[];
  sellingAngles: string[];
  originalShotPlan: TrendShot[];
  referenceRule: string;
  generatedAt: string;
  model: string;
};

const RIGHTS = new Set<MediaRightsStatus>([
  "owned",
  "seller-provided",
  "affiliate-provided",
  "permission-confirmed",
  "unverified",
]);
const PLATFORMS = new Set<MediaPlatform>(["douyin", "xiaohongshu", "coupang", "temu", "owned", "other"]);

function safeUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!url) throw new Error("소재 URL을 입력해주세요.");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("소재 URL은 HTTPS 주소만 사용할 수 있습니다.");
  const hostname = parsed.hostname.toLowerCase();
  const blocked = hostname === "localhost"
    || hostname === "0.0.0.0"
    || hostname === "::1"
    || hostname.endsWith(".local")
    || hostname === "metadata.google.internal"
    || /^127\./.test(hostname)
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^169\.254\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  if (blocked) throw new Error("내부 네트워크 주소는 소재 URL로 사용할 수 없습니다.");
  return parsed.toString();
}

export function normalizeMediaReferences(value: unknown): MediaReference[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((item, index) => {
    const raw = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    const rightsStatus = RIGHTS.has(String(raw.rightsStatus) as MediaRightsStatus)
      ? String(raw.rightsStatus) as MediaRightsStatus
      : "unverified";
    const platform = PLATFORMS.has(String(raw.platform) as MediaPlatform)
      ? String(raw.platform) as MediaPlatform
      : "other";
    return {
      id: String(raw.id || `media-${Date.now()}-${index}`).slice(0, 100),
      platform,
      url: safeUrl(raw.url),
      title: String(raw.title || "").trim().slice(0, 120),
      rightsStatus,
      useInFinal: rightsStatus !== "unverified" && Boolean(raw.useInFinal),
      notes: String(raw.notes || "").trim().slice(0, 1000),
      createdAt: String(raw.createdAt || new Date().toISOString()),
    };
  });
}

export function finalUseRightsViolations(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.flatMap((item, index) => {
    const raw = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    if (!raw.useInFinal) return [];
    if (String(raw.rightsStatus) === "unverified") {
      return [String(raw.title || raw.url || `소재 ${index + 1}`)];
    }
    return [];
  });
}

export function gyProductCode(projectId: string) {
  return `GY-${projectId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
}

const trendSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    chineseKeywords: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          simplifiedChinese: { type: "string" },
          koreanMeaning: { type: "string" },
          searchIntent: { type: "string" },
        },
        required: ["simplifiedChinese", "koreanMeaning", "searchIntent"],
      },
    },
    hookPatterns: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    sellingAngles: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
    originalShotPlan: {
      type: "array",
      minItems: 5,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          order: { type: "integer" },
          durationSeconds: { type: "number", minimum: 0.7, maximum: 2.5 },
          role: { type: "string" },
          camera: { type: "string" },
          direction: { type: "string" },
          assetType: { type: "string", enum: ["photo", "licensed-video", "generated-scene"] },
        },
        required: ["order", "durationSeconds", "role", "camera", "direction", "assetType"],
      },
    },
  },
  required: ["chineseKeywords", "hookPatterns", "sellingAngles", "originalShotPlan"],
} as const;

export async function generateTrendIntelligence(input: {
  productName: string;
  productDescription: string;
  durationSeconds: number;
  referenceNotes?: string[];
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
          "당신은 GY-NEXUS 쇼핑 쇼츠의 한국·중국 콘텐츠 전략가다.",
          `상품명: ${input.productName}`,
          `검증된 상품 설명: ${input.productDescription || "확인된 설명 없음"}`,
          `목표 길이: ${input.durationSeconds}초`,
          `사용자가 적은 참고 메모: ${(input.referenceNotes || []).join(" / ") || "없음"}`,
          "한국 상품을 도우인·샤오홍슈에서 탐색할 간결한 중국어(간체) 검색어를 만든다.",
          "실시간 인기 순위나 조회수를 확인한 것처럼 말하지 않는다. 결과는 탐색 키워드와 독창적 연출 설계다.",
          "참고 메모에서는 훅 방식·촬영 각도·장면 리듬·판매 포인트만 추상화한다.",
          "원본 영상 문장, 고유 장면 순서, 워터마크, 인물, 음악을 복제하지 않는다.",
          "각 컷은 0.7~2.5초다. 첫 3초 안에 문제나 결과가 분명해야 한다.",
          "상품 설명에 없는 가격·수치·효능·후기를 만들지 않는다.",
          "사진만으로도 실행 가능한 계획을 우선하되, 사용 허가 영상이 있을 때만 licensed-video를 제안한다.",
        ].join("\n"),
      }],
    }],
    text: { format: { type: "json_schema", name: "gy_shopping_trend_intelligence", strict: true, schema: trendSchema } },
    max_output_tokens: 3800,
  });
  const raw = response.output_text?.trim();
  if (!raw) throw new Error("중국 트렌드 참고 설계 결과가 비어 있습니다.");
  const parsed = JSON.parse(raw) as Omit<TrendIntelligence, "discoveryLinks" | "referenceRule" | "generatedAt" | "model">;
  const keywords = parsed.chineseKeywords.slice(0, 6);
  const discoveryLinks = keywords.slice(0, 4).flatMap((keyword) => {
    const query = encodeURIComponent(keyword.simplifiedChinese);
    return [
      { platform: "douyin" as const, keyword: keyword.simplifiedChinese, url: `https://www.douyin.com/search/${query}` },
      { platform: "xiaohongshu" as const, keyword: keyword.simplifiedChinese, url: `https://www.xiaohongshu.com/search_result?keyword=${query}` },
    ];
  });
  const result: TrendIntelligence = {
    ...parsed,
    chineseKeywords: keywords,
    discoveryLinks,
    referenceRule: "권리 미확인 자료는 훅·각도·리듬 분석 참고만 허용하며 최종 영상에는 사용하지 않습니다.",
    generatedAt: new Date().toISOString(),
    model,
  };
  return { model, result };
}
