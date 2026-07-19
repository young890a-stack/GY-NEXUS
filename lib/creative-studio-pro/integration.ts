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
  assetKind: "page-link" | "video-file";
  rightsStatus: MediaRightsStatus;
  useInFinal: boolean;
  includeInMixAnalysis: boolean;
  notes: string;
  analysisFrameUrls: string[];
  selectedKeywords: string[];
  analysis?: ReferenceAnalysis;
  createdAt: string;
};

export type ReferenceAnalysis = {
  productName: string;
  sourceSummary: string;
  keywordCandidates: Array<{
    keyword: string;
    language: "ko" | "zh-CN";
    recommended: boolean;
    reason: string;
  }>;
  hookPatterns: string[];
  salesPoints: string[];
  sceneDecisions: Array<{
    frameIndex: number;
    decision: "keep" | "remove" | "recreate";
    role: string;
    reason: string;
    suggestedDurationSeconds: number;
  }>;
  mixPlan: Array<{
    order: number;
    durationSeconds: number;
    role: string;
    direction: string;
    source: "uploaded-photo" | "licensed-video" | "new-ai-scene";
  }>;
  copyrightSafety: string;
  analyzedAt: string;
  model: string;
};

export type SourceMixPlan = {
  title: string;
  totalDurationSeconds: number;
  selectedReferenceIds: string[];
  cuts: Array<{
    order: number;
    startSecond: number;
    durationSeconds: number;
    referenceId: string;
    frameIndex: number;
    role: string;
    decision: "use-licensed" | "recreate" | "generated";
    direction: string;
    subtitleIntent: string;
  }>;
  safetySummary: string;
  generatedAt: string;
  model: string;
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
    const assetKind = raw.assetKind === "video-file" ? "video-file" as const : "page-link" as const;
    return {
      id: String(raw.id || `media-${Date.now()}-${index}`).slice(0, 100),
      platform,
      url: safeUrl(raw.url),
      title: String(raw.title || "").trim().slice(0, 120),
      assetKind,
      rightsStatus,
      useInFinal: assetKind === "video-file" && rightsStatus !== "unverified" && Boolean(raw.useInFinal),
      includeInMixAnalysis: raw.includeInMixAnalysis !== false,
      notes: String(raw.notes || "").trim().slice(0, 1000),
      analysisFrameUrls: Array.isArray(raw.analysisFrameUrls)
        ? raw.analysisFrameUrls.map(String).map((item) => safeUrl(item)).slice(0, 8)
        : [],
      selectedKeywords: Array.isArray(raw.selectedKeywords)
        ? raw.selectedKeywords.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 12)
        : [],
      ...(raw.analysis && typeof raw.analysis === "object" && !Array.isArray(raw.analysis)
        ? { analysis: raw.analysis as ReferenceAnalysis }
        : {}),
      createdAt: String(raw.createdAt || new Date().toISOString()),
    };
  });
}

const referenceAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    productName: { type: "string" },
    sourceSummary: { type: "string" },
    keywordCandidates: {
      type: "array",
      minItems: 6,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          keyword: { type: "string" },
          language: { type: "string", enum: ["ko", "zh-CN"] },
          recommended: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["keyword", "language", "recommended", "reason"],
      },
    },
    hookPatterns: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
    salesPoints: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } },
    sceneDecisions: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          frameIndex: { type: "integer", minimum: 1, maximum: 8 },
          decision: { type: "string", enum: ["keep", "remove", "recreate"] },
          role: { type: "string" },
          reason: { type: "string" },
          suggestedDurationSeconds: { type: "number", minimum: 0.7, maximum: 2.5 },
        },
        required: ["frameIndex", "decision", "role", "reason", "suggestedDurationSeconds"],
      },
    },
    mixPlan: {
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
          direction: { type: "string" },
          source: { type: "string", enum: ["uploaded-photo", "licensed-video", "new-ai-scene"] },
        },
        required: ["order", "durationSeconds", "role", "direction", "source"],
      },
    },
    copyrightSafety: { type: "string" },
  },
  required: ["productName", "sourceSummary", "keywordCandidates", "hookPatterns", "salesPoints", "sceneDecisions", "mixPlan", "copyrightSafety"],
} as const;

const sourceMixSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    cuts: {
      type: "array",
      minItems: 5,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          order: { type: "integer" },
          durationSeconds: { type: "number", minimum: 0.7, maximum: 2.5 },
          referenceId: { type: "string" },
          frameIndex: { type: "integer", minimum: 0, maximum: 8 },
          role: { type: "string" },
          decision: { type: "string", enum: ["use-licensed", "recreate", "generated"] },
          direction: { type: "string" },
          subtitleIntent: { type: "string" },
        },
        required: ["order", "durationSeconds", "referenceId", "frameIndex", "role", "decision", "direction", "subtitleIntent"],
      },
    },
    safetySummary: { type: "string" },
  },
  required: ["title", "cuts", "safetySummary"],
} as const;

function decodeMetadataText(value: string) {
  return value
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchAllowedReferencePage(initialUrl: URL, allowedDomains: string[]) {
  let current = initialUrl;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const hostname = current.hostname.toLowerCase();
    if (current.protocol !== "https:" || !allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      throw new Error("허용되지 않은 참고자료 리디렉션입니다.");
    }
    const response = await fetch(current, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
      redirect: "manual",
      headers: { "User-Agent": "GY-NEXUS-Metadata/2.2" },
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    current = new URL(location, current);
  }
  throw new Error("참고자료 리디렉션이 너무 많습니다.");
}

export async function publicReferenceMetadata(url: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"].includes(hostname)) {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (!response.ok) return null;
      const data = await response.json() as { title?: string; author_name?: string; thumbnail_url?: string };
      return {
        title: String(data.title || "").trim(),
        author: String(data.author_name || "").trim(),
        thumbnailUrl: String(data.thumbnail_url || "").trim(),
      };
    }
    const allowedDomains = ["douyin.com", "xiaohongshu.com", "xhslink.com", "coupang.com", "temu.com", "temu.to"];
    if (!allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) return null;
    const response = await fetchAllowedReferencePage(parsed, allowedDomains);
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 2 * 1024 * 1024) return null;
    const html = (await response.text()).slice(0, 2 * 1024 * 1024);
    const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
      || "";
    const thumbnailCandidate = decodeMetadataText(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["'](https:[^"']+)["']/i)?.[1] || "");
    let thumbnailUrl = "";
    try {
      thumbnailUrl = thumbnailCandidate ? safeUrl(thumbnailCandidate) : "";
    } catch {
      thumbnailUrl = "";
    }
    return {
      title: decodeMetadataText(title).slice(0, 300),
      author: "",
      thumbnailUrl,
    };
  } catch {
    return null;
  }
}

export async function analyzeReferenceMaterial(input: {
  projectProductName: string;
  projectProductDescription: string;
  durationSeconds: number;
  reference: MediaReference;
}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
  const metadata = await publicReferenceMetadata(input.reference.url);
  const imageUrls = Array.from(new Set([
    ...input.reference.analysisFrameUrls,
    metadata?.thumbnailUrl || "",
  ].filter(Boolean))).slice(0, 8);
  if (!imageUrls.length && !input.reference.notes && !input.reference.title && !metadata?.title) {
    throw new Error("보호된 영상 URL만으로는 장면을 볼 수 없습니다. 분석 프레임 이미지나 참고 메모를 추가해주세요.");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_FAST_MODEL || process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_QUALITY_MODEL || "gpt-5.6-sol";
  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "low" }
  > = [{
    type: "input_text",
    text: [
      "당신은 GY-NEXUS의 쇼핑 쇼츠 벤치마크 분석 감독이다.",
      `제작 상품: ${input.projectProductName}`,
      `검증된 상품 설명: ${input.projectProductDescription || "없음"}`,
      `목표 길이: ${input.durationSeconds}초`,
      `참고 플랫폼: ${input.reference.platform}`,
      `참고 제목: ${input.reference.title || metadata?.title || "미입력"}`,
      `작성자 정보: ${metadata?.author || "확인 안 됨"}`,
      `대표 확인 메모: ${input.reference.notes || "없음"}`,
      `소재 권리: ${input.reference.rightsStatus}`,
      `분석 프레임 수: ${imageUrls.length}`,
      "이미지가 있으면 입력 순서대로 프레임 1번부터 분석한다.",
      "상품과 무관한 인물 소개, 채널 워터마크, 반복 장면, 빈 화면은 remove로 분류한다.",
      "판매 구조에 유용하지만 그대로 복제하면 안 되는 장면은 recreate로 분류한다.",
      "직접 촬영 또는 사용 허가 자료이며 상품과 정확히 맞는 장면만 keep 후보로 분류한다.",
      "키워드는 한국어와 중국어 간체를 함께 제안하고 실제 화면에서 확인할 수 없는 조회수나 인기를 만들지 않는다.",
      "원본 문장, 얼굴, 음악, 워터마크, 고유 편집 순서를 복제하지 않고 훅·각도·리듬·판매 포인트만 추상화한다.",
      "최종 mixPlan은 0.7~2.5초 컷으로 구성하며 권리 미확인 영상은 source를 licensed-video로 절대 지정하지 않는다.",
    ].join("\n"),
  }];
  imageUrls.forEach((url) => content.push({ type: "input_image", image_url: url, detail: "low" }));
  const response = await openai.responses.create({
    model,
    reasoning: { effort: "medium" },
    input: [{ role: "user", content }],
    text: { format: { type: "json_schema", name: "gy_reference_scene_analysis", strict: true, schema: referenceAnalysisSchema } },
    max_output_tokens: 4200,
  });
  const raw = response.output_text?.trim();
  if (!raw) throw new Error("참고영상 장면 분석 결과가 비어 있습니다.");
  const parsed = JSON.parse(raw) as Omit<ReferenceAnalysis, "analyzedAt" | "model">;
  const result: ReferenceAnalysis = {
    ...parsed,
    sceneDecisions: parsed.sceneDecisions.slice(0, imageUrls.length || 8),
    copyrightSafety: input.reference.rightsStatus === "unverified"
      ? "권리 미확인 자료입니다. 키워드·훅·각도·리듬 참고만 가능하며 최종 영상 사용은 차단됩니다."
      : parsed.copyrightSafety,
    analyzedAt: new Date().toISOString(),
    model,
  };
  return { model, result };
}

export async function generateSelectedSourceMix(input: {
  productName: string;
  productDescription: string;
  durationSeconds: number;
  references: MediaReference[];
}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
  const references = input.references.filter((item) => item.includeInMixAnalysis).slice(0, 8);
  if (!references.length) throw new Error("AI 믹스에 사용할 쇼츠 소스를 하나 이상 선택해주세요.");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_FAST_MODEL || process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_QUALITY_MODEL || "gpt-5.6-sol";
  const visualReferences = references.flatMap((item) => item.analysisFrameUrls.slice(0, 2).map((url, frameIndex) => ({
    referenceId: item.id,
    frameIndex: frameIndex + 1,
    url,
  }))).slice(0, 8);
  const sourceSummary = references.map((item) => ({
    id: item.id,
    platform: item.platform,
    title: item.title,
    notes: item.notes,
    assetKind: item.assetKind,
    rightsStatus: item.rightsStatus,
    mayUseOriginalVideo: item.assetKind === "video-file" && item.useInFinal && item.rightsStatus !== "unverified",
    visibleFrameNumbers: visualReferences.filter((frame) => frame.referenceId === item.id).map((frame) => frame.frameIndex),
    selectedKeywords: item.selectedKeywords,
    analysis: item.analysis ? {
      sourceSummary: item.analysis.sourceSummary,
      hookPatterns: item.analysis.hookPatterns,
      salesPoints: item.analysis.salesPoints,
      sceneDecisions: item.analysis.sceneDecisions,
      mixPlan: item.analysis.mixPlan,
    } : null,
  }));
  const mixContent: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "low" }
  > = [{
    type: "input_text",
    text: [
      "당신은 GY-NEXUS의 쇼핑 쇼츠 믹스 편집감독이다.",
      `상품명: ${input.productName}`,
      `검증된 상품 설명: ${input.productDescription || "없음"}`,
      `최종 목표 길이: ${input.durationSeconds}초`,
      `대표가 선택한 소스: ${JSON.stringify(sourceSummary)}`,
      `뒤에 첨부된 이미지 순서: ${JSON.stringify(visualReferences.map((frame, index) => ({ inputImage: index + 1, referenceId: frame.referenceId, frameIndex: frame.frameIndex })))}`,
      "첨부된 이미지는 공개 검색 카드의 대표 이미지 또는 대표가 올린 분석 프레임이며, 영상 원본 전체로 단정하지 않는다.",
      "첫 2초에 결과나 문제를 보여주고, 중간에는 사용 장면과 판매 포인트, 마지막에는 과장 없는 CTA를 배치한다.",
      "여러 소스의 고유 순서를 그대로 이어붙이지 말고 완전히 새로운 한국형 판매 순서로 재구성한다.",
      "use-licensed는 mayUseOriginalVideo가 true인 video-file에만 허용한다.",
      "권리 미확인 또는 page-link 소스는 아이디어만 참고하고 반드시 recreate 또는 generated로 만든다.",
      "원본 얼굴, 음악, 워터마크, 자막 문장, 고유 편집 순서를 복제하지 않는다.",
      "각 컷은 0.7~2.5초이며 전체 컷 길이 합은 목표 길이에 최대한 맞춘다.",
      "referenceId는 위 목록의 정확한 id를 쓰며 새 장면은 빈 문자열로 쓴다.",
      "frameIndex는 실제로 첨부된 해당 소스 프레임을 참고할 때만 표시된 번호를 쓰고, 아니면 0이다.",
    ].join("\n"),
  }];
  visualReferences.forEach((frame) => mixContent.push({ type: "input_image", image_url: frame.url, detail: "low" }));
  const response = await openai.responses.create({
    model,
    reasoning: { effort: "medium" },
    input: [{
      role: "user",
      content: mixContent,
    }],
    text: { format: { type: "json_schema", name: "gy_selected_source_mix", strict: true, schema: sourceMixSchema } },
    max_output_tokens: 4500,
  });
  const raw = response.output_text?.trim();
  if (!raw) throw new Error("선택 소스 AI 믹스 결과가 비어 있습니다.");
  const parsed = JSON.parse(raw) as { title: string; cuts: SourceMixPlan["cuts"]; safetySummary: string };
  const referenceMap = new Map(references.map((item) => [item.id, item]));
  const target = Math.max(15, Math.min(30, Number(input.durationSeconds) || 20));
  const cuts: SourceMixPlan["cuts"] = [];
  let cursor = 0;
  for (const rawCut of parsed.cuts.slice(0, 12)) {
    if (cursor >= target - .7) break;
    const reference = referenceMap.get(String(rawCut.referenceId || ""));
    const licensed = Boolean(
      reference
      && reference.assetKind === "video-file"
      && reference.useInFinal
      && reference.rightsStatus !== "unverified",
    );
    const decision = rawCut.decision === "use-licensed" && !licensed ? "recreate" : rawCut.decision;
    const remaining = target - cursor;
    const durationSeconds = Number(Math.min(2.5, Math.max(.7, Number(rawCut.durationSeconds) || 1.5), remaining).toFixed(2));
    cuts.push({
      ...rawCut,
      order: cuts.length + 1,
      startSecond: Number(cursor.toFixed(2)),
      durationSeconds,
      referenceId: reference?.id || "",
      frameIndex: reference ? Math.max(0, Math.min(8, Number(rawCut.frameIndex) || 0)) : 0,
      decision,
    });
    cursor += durationSeconds;
  }
  while (cursor < target - .7 && cuts.length < 12) {
    const durationSeconds = Number(Math.min(2.5, target - cursor).toFixed(2));
    cuts.push({
      order: cuts.length + 1,
      startSecond: Number(cursor.toFixed(2)),
      durationSeconds,
      referenceId: "",
      frameIndex: 0,
      role: cuts.length ? "판매 포인트 연결" : "첫 2초 훅",
      decision: "generated",
      direction: "실제 상품 사진을 보존한 새로운 한국형 장면으로 연결한다.",
      subtitleIntent: "검증된 상품 사실만 짧게 강조",
    });
    cursor += durationSeconds;
  }
  const result: SourceMixPlan = {
    title: String(parsed.title || `${input.productName} 선택 소스 믹스`).slice(0, 120),
    totalDurationSeconds: Number(cursor.toFixed(2)),
    selectedReferenceIds: references.map((item) => item.id),
    cuts,
    safetySummary: String(parsed.safetySummary || "권리 확인 원본만 사용하고 나머지는 새 장면으로 재제작합니다."),
    generatedAt: new Date().toISOString(),
    model,
  };
  return { model, result };
}

export function finalUseRightsViolations(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.flatMap((item, index) => {
    const raw = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    if (!raw.useInFinal) return [];
    if (String(raw.rightsStatus) === "unverified" || raw.assetKind !== "video-file") {
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
  const model = process.env.OPENAI_FAST_MODEL || process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_QUALITY_MODEL || "gpt-5.6-sol";
  const response = await openai.responses.create({
    model,
    reasoning: { effort: "medium" },
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
