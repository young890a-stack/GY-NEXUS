import { GoogleGenAI } from "@google/genai";

export type SceneRightsStatus = "owned" | "seller-provided" | "affiliate-provided" | "permission-confirmed" | "unverified";
export type SceneRole = "hook" | "problem" | "product-intro" | "demonstration" | "proof" | "comparison" | "benefit" | "cta" | "other";

export type SceneSegmentResult = {
  sceneIndex: number;
  startSecond: number;
  endSecond: number;
  role: SceneRole;
  visualDescription: string;
  cameraDirection: string;
  onScreenText: string;
  audioNarration: string;
  emotion: string;
  productVisibilityScore: number;
  hookScore: number;
  proofScore: number;
  copyrightRiskScore: number;
  reusablePattern: string;
  recreateDirection: string;
  evidence: string;
  representativeTimestamp: number;
};

export type SceneIntelligenceResult = {
  summary: string;
  productMatchScore: number;
  commercialPotentialScore: number;
  structureClarityScore: number;
  originalityRiskScore: number;
  recommendedVariant: "A" | "B" | "C";
  hookFormula: string;
  proofFormula: string;
  ctaFormula: string;
  reusablePatterns: string[];
  prohibitedCopyElements: string[];
  koreanRecreationBlueprint: string[];
  scenes: SceneSegmentResult[];
};

const sceneSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    productMatchScore: { type: "integer" },
    commercialPotentialScore: { type: "integer" },
    structureClarityScore: { type: "integer" },
    originalityRiskScore: { type: "integer" },
    recommendedVariant: { type: "string", enum: ["A", "B", "C"] },
    hookFormula: { type: "string" },
    proofFormula: { type: "string" },
    ctaFormula: { type: "string" },
    reusablePatterns: { type: "array", items: { type: "string" }, maxItems: 12 },
    prohibitedCopyElements: { type: "array", items: { type: "string" }, maxItems: 12 },
    koreanRecreationBlueprint: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 12 },
    scenes: {
      type: "array",
      minItems: 2,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          sceneIndex: { type: "integer" },
          startSecond: { type: "number" },
          endSecond: { type: "number" },
          role: { type: "string", enum: ["hook", "problem", "product-intro", "demonstration", "proof", "comparison", "benefit", "cta", "other"] },
          visualDescription: { type: "string" },
          cameraDirection: { type: "string" },
          onScreenText: { type: "string" },
          audioNarration: { type: "string" },
          emotion: { type: "string" },
          productVisibilityScore: { type: "integer" },
          hookScore: { type: "integer" },
          proofScore: { type: "integer" },
          copyrightRiskScore: { type: "integer" },
          reusablePattern: { type: "string" },
          recreateDirection: { type: "string" },
          evidence: { type: "string" },
          representativeTimestamp: { type: "number" },
        },
        required: ["sceneIndex", "startSecond", "endSecond", "role", "visualDescription", "cameraDirection", "onScreenText", "audioNarration", "emotion", "productVisibilityScore", "hookScore", "proofScore", "copyrightRiskScore", "reusablePattern", "recreateDirection", "evidence", "representativeTimestamp"],
      },
    },
  },
  required: ["summary", "productMatchScore", "commercialPotentialScore", "structureClarityScore", "originalityRiskScore", "recommendedVariant", "hookFormula", "proofFormula", "ctaFormula", "reusablePatterns", "prohibitedCopyElements", "koreanRecreationBlueprint", "scenes"],
} as const;

const allowedRoles: SceneRole[] = ["hook", "problem", "product-intro", "demonstration", "proof", "comparison", "benefit", "cta", "other"];
const allowedRights = new Set<SceneRightsStatus>(["owned", "seller-provided", "affiliate-provided", "permission-confirmed"]);

export function isVerifiedSceneRights(value: unknown): value is Exclude<SceneRightsStatus, "unverified"> {
  return allowedRights.has(String(value) as SceneRightsStatus);
}

export function getGeminiSceneApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || "";
}

export function getGeminiSceneModel() {
  return process.env.GEMINI_VIDEO_ANALYSIS_MODEL?.trim() || "gemini-3.5-flash";
}

function clean(value: unknown, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function score(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}


export function sceneAnalysisPrompt(input: {
  productQuery: string;
  candidateTitle: string;
  platform: string;
  durationSeconds?: number | null;
  frameTimestamps?: number[];
}) {
  const frameNote = input.frameTimestamps?.length
    ? `제공된 대표 프레임의 대략적인 시간(초): ${input.frameTimestamps.join(", ")}`
    : "동영상의 실제 타임스탬프를 근거로 장면을 구분한다.";
  return [
    "당신은 GY-NEXUS의 쇼핑 쇼츠 장면 구조 분석가다.",
    `대상 상품: ${input.productQuery}`,
    `후보 제목: ${input.candidateTitle}`,
    `플랫폼: ${input.platform}`,
    `알려진 길이: ${input.durationSeconds ?? "미확인"}초`,
    frameNote,
    "영상을 그대로 복제하거나 고유 문장·인물·로고·음악·촬영 구도를 재사용하도록 지시하지 않는다.",
    "대신 첫 훅, 문제, 사용, 증명, 비교, 혜택, CTA의 기능적 구조와 재창작 가능한 패턴을 분석한다.",
    "보이지 않거나 들리지 않는 내용은 추정하지 말고 evidence에 불확실성을 적는다.",
    "각 장면의 시작·종료 초, 카메라, 화면문구, 음성, 감정, 상품 노출, 훅·증명·저작권 위험을 평가한다.",
    "koreanRecreationBlueprint는 한국 소비자용 신규 촬영·신규 AI 장면 방향으로 작성한다.",
  ].join("\n");
}

export function manualScenePrompt(input: Parameters<typeof sceneAnalysisPrompt>[0]) {
  return [
    sceneAnalysisPrompt(input),
    "Gemini Pro에 사용 권한이 확인된 영상 파일을 직접 첨부한 뒤 아래 JSON 구조만 출력한다.",
    JSON.stringify({
      summary: "",
      productMatchScore: 0,
      commercialPotentialScore: 0,
      structureClarityScore: 0,
      originalityRiskScore: 0,
      recommendedVariant: "A",
      hookFormula: "",
      proofFormula: "",
      ctaFormula: "",
      reusablePatterns: [],
      prohibitedCopyElements: [],
      koreanRecreationBlueprint: [],
      scenes: [{
        sceneIndex: 1, startSecond: 0, endSecond: 2, role: "hook",
        visualDescription: "", cameraDirection: "", onScreenText: "", audioNarration: "", emotion: "",
        productVisibilityScore: 0, hookScore: 0, proofScore: 0, copyrightRiskScore: 0,
        reusablePattern: "", recreateDirection: "", evidence: "", representativeTimestamp: 1,
      }],
    }, null, 2),
  ].join("\n\n");
}

export function validateSceneIntelligence(value: unknown, durationSeconds = 600): SceneIntelligenceResult {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rawScenes = Array.isArray(source.scenes) ? source.scenes : [];
  const scenes = rawScenes.flatMap((raw, index) => {
    const item = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const start = Math.max(0, Math.min(durationSeconds, Number(item.startSecond) || 0));
    const end = Math.max(start, Math.min(durationSeconds, Number(item.endSecond) || start));
    const role = allowedRoles.includes(String(item.role) as SceneRole) ? String(item.role) as SceneRole : "other";
    return [{
      sceneIndex: Math.max(1, Math.round(Number(item.sceneIndex) || index + 1)),
      startSecond: Number(start.toFixed(3)),
      endSecond: Number(end.toFixed(3)),
      role,
      visualDescription: clean(item.visualDescription, 800),
      cameraDirection: clean(item.cameraDirection, 400),
      onScreenText: clean(item.onScreenText, 400),
      audioNarration: clean(item.audioNarration, 500),
      emotion: clean(item.emotion, 200),
      productVisibilityScore: score(item.productVisibilityScore),
      hookScore: score(item.hookScore),
      proofScore: score(item.proofScore),
      copyrightRiskScore: score(item.copyrightRiskScore),
      reusablePattern: clean(item.reusablePattern, 500),
      recreateDirection: clean(item.recreateDirection, 800),
      evidence: clean(item.evidence, 800),
      representativeTimestamp: Number(Math.max(start, Math.min(end || durationSeconds, Number(item.representativeTimestamp) || start)).toFixed(3)),
    }];
  }).sort((a, b) => a.startSecond - b.startSecond).slice(0, 20);
  if (scenes.length < 2) throw new Error("장면 분석 결과가 2개보다 적습니다.");
  const variant = ["A", "B", "C"].includes(String(source.recommendedVariant)) ? String(source.recommendedVariant) as "A" | "B" | "C" : "A";
  return {
    summary: clean(source.summary, 1200),
    productMatchScore: score(source.productMatchScore),
    commercialPotentialScore: score(source.commercialPotentialScore),
    structureClarityScore: score(source.structureClarityScore),
    originalityRiskScore: score(source.originalityRiskScore),
    recommendedVariant: variant,
    hookFormula: clean(source.hookFormula, 500),
    proofFormula: clean(source.proofFormula, 500),
    ctaFormula: clean(source.ctaFormula, 500),
    reusablePatterns: Array.isArray(source.reusablePatterns) ? source.reusablePatterns.map((x) => clean(x, 400)).filter(Boolean).slice(0, 12) : [],
    prohibitedCopyElements: Array.isArray(source.prohibitedCopyElements) ? source.prohibitedCopyElements.map((x) => clean(x, 400)).filter(Boolean).slice(0, 12) : [],
    koreanRecreationBlueprint: Array.isArray(source.koreanRecreationBlueprint) ? source.koreanRecreationBlueprint.map((x) => clean(x, 600)).filter(Boolean).slice(0, 12) : [],
    scenes,
  };
}

async function responseToResult(interaction: { output_text?: string | null }, durationSeconds: number) {
  return validateSceneIntelligence(JSON.parse(interaction.output_text || "{}"), durationSeconds);
}

export async function analyzeVideoWithGemini(input: {
  video: Buffer;
  mimeType: string;
  productQuery: string;
  candidateTitle: string;
  platform: string;
  durationSeconds: number;
}) {
  const apiKey = getGeminiSceneApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  const client = new GoogleGenAI({ apiKey });
  const interaction = await client.interactions.create({
    model: getGeminiSceneModel(),
    system_instruction: "쇼핑 쇼츠의 기능적 장면 구조를 분석하고 저작권 침해가 아닌 신규 한국형 재창작 방향만 제시한다.",
    input: [
      { type: "video", data: input.video.toString("base64"), mime_type: input.mimeType },
      { type: "text", text: sceneAnalysisPrompt(input) },
    ],
    response_format: { type: "text", mime_type: "application/json", schema: sceneSchema },
  });
  return responseToResult(interaction, input.durationSeconds);
}

export async function analyzeFramesWithGemini(input: {
  frames: Array<{ data: Buffer; mimeType: string; timestamp: number }>;
  productQuery: string;
  candidateTitle: string;
  platform: string;
  durationSeconds: number;
}) {
  const apiKey = getGeminiSceneApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  const client = new GoogleGenAI({ apiKey });
  const media: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mime_type: string }
  > = input.frames.flatMap((frame) => ([
    { type: "text" as const, text: `대표 프레임 시간: ${frame.timestamp.toFixed(3)}초` },
    { type: "image" as const, data: frame.data.toString("base64"), mime_type: frame.mimeType },
  ]));
  const interaction = await client.interactions.create({
    model: getGeminiSceneModel(),
    system_instruction: "시간순 대표 프레임을 근거로 쇼핑 쇼츠 구조를 분석한다. 보이지 않는 오디오나 중간 장면을 추정하지 않는다.",
    input: [...media, { type: "text" as const, text: sceneAnalysisPrompt({ ...input, frameTimestamps: input.frames.map((x) => x.timestamp) }) }],
    response_format: { type: "text", mime_type: "application/json", schema: sceneSchema },
  });
  return responseToResult(interaction, input.durationSeconds);
}
