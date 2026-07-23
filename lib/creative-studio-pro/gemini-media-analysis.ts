import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "@/lib/ai/gemini";

export type GeminiSelectedCut = {
  order: number;
  frameIndex: number;
  sourceStartSecond: number;
  sourceEndSecond: number;
  durationSeconds: number;
  score: number;
  role: string;
  reason: string;
  subtitleSuggestion: string;
};

export type GeminiMediaAnalysis = {
  summary: string;
  productMatchScore: number;
  visualQualityScore: number;
  bestHookTimestamp: number;
  recommendedCuts: GeminiSelectedCut[];
  rejectedMoments: string[];
  warnings: string[];
  model: string;
  analyzedAt: string;
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    productMatchScore: { type: "integer", minimum: 0, maximum: 100 },
    visualQualityScore: { type: "integer", minimum: 0, maximum: 100 },
    bestHookTimestamp: { type: "number", minimum: 0 },
    recommendedCuts: {
      type: "array",
      minItems: 3,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          order: { type: "integer", minimum: 1 },
          frameIndex: { type: "integer", minimum: 1, maximum: 12 },
          sourceStartSecond: { type: "number", minimum: 0 },
          sourceEndSecond: { type: "number", minimum: 0 },
          score: { type: "integer", minimum: 0, maximum: 100 },
          role: { type: "string" },
          reason: { type: "string" },
          subtitleSuggestion: { type: "string" },
        },
        required: ["order", "frameIndex", "sourceStartSecond", "sourceEndSecond", "score", "role", "reason", "subtitleSuggestion"],
      },
    },
    rejectedMoments: { type: "array", maxItems: 8, items: { type: "string" } },
    warnings: { type: "array", maxItems: 8, items: { type: "string" } },
  },
  required: ["summary", "productMatchScore", "visualQualityScore", "bestHookTimestamp", "recommendedCuts", "rejectedMoments", "warnings"],
} as const;

function clamp(value: unknown, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

async function framePart(url: string, index: number, timestamp: number) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`프레임 ${index + 1} 다운로드 실패: ${response.status}`);
  const contentType = String(response.headers.get("content-type") || "image/jpeg").split(";")[0];
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error(`프레임 ${index + 1} 파일이 너무 큽니다.`);
  return [
    { type: "text", text: `프레임 ${index + 1} · 원본 영상 ${timestamp.toFixed(2)}초` },
    { type: "image", data: bytes.toString("base64"), mime_type: contentType },
  ];
}

export async function analyzeVideoFramesWithGemini(input: {
  productName: string;
  productDescription: string;
  targetDurationSeconds: number;
  frameUrls: string[];
  frameTimestamps: number[];
  sourceDurationSeconds: number;
}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY 또는 GOOGLE_AI_API_KEY가 없습니다.");
  const frames = input.frameUrls.slice(0, 12);
  if (frames.length < 3) throw new Error("Gemini 분석에 필요한 영상 프레임이 부족합니다.");

  const frameInputs = (await Promise.all(frames.map((url, index) => framePart(
    url,
    index,
    Number(input.frameTimestamps[index]) || 0,
  )))).flat();

  const model = process.env.GEMINI_VIDEO_MODEL?.trim()
    || process.env.GEMINI_REVIEW_MODEL?.trim()
    || "gemini-3.5-flash";
  const client = new GoogleGenAI({ apiKey });
  const interaction = await client.interactions.create({
    model,
    system_instruction:
      "당신은 GY-NEXUS의 한국 쇼핑 쇼츠 영상 편집감독이다. 대표가 직접 촬영하거나 사용 권한을 가진 영상의 프레임과 시간정보를 보고, 제품이 잘 보이고 움직임이 명확하며 첫 2초에 시선을 잡는 구간만 선택한다. 과장광고, 흐림, 손떨림, 워터마크, 불필요한 얼굴 노출, 제품이 가려지는 장면은 감점한다. 결과는 제공된 JSON 스키마만 따른다.",
    input: [
      {
        type: "text",
        text: [
          `상품명: ${input.productName}`,
          `상품 설명: ${input.productDescription || "없음"}`,
          `원본 영상 길이: ${input.sourceDurationSeconds.toFixed(2)}초`,
          `완성 쇼츠 목표 길이: ${input.targetDurationSeconds}초`,
          `프레임 시간표: ${JSON.stringify(input.frameTimestamps.slice(0, 12))}`,
          "추천 컷은 원본 영상 시간 기준 sourceStartSecond와 sourceEndSecond를 제시한다.",
          "각 컷 길이는 0.7~2.5초로 하고, 첫 컷은 결과·문제·강한 제품 동작 중 하나가 즉시 보여야 한다.",
          "순서는 훅 → 문제/상황 → 사용 → 제품 디테일/혜택 → CTA가 되게 구성한다.",
          "같은 구간을 반복하지 말고 전체 추천 컷 길이 합이 목표 길이에 최대한 가까워지게 한다.",
          "자막 제안은 한 줄 16자 이내의 자연스러운 한국어로 작성한다.",
        ].join("\n"),
      },
      ...frameInputs,
    ] as never,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema,
    },
  });

  const raw = interaction.output_text?.trim();
  if (!raw) throw new Error("Gemini 소재 분석 결과가 비어 있습니다.");
  const parsed = JSON.parse(raw) as Partial<GeminiMediaAnalysis>;
  const sourceDuration = Math.max(1, Number(input.sourceDurationSeconds) || 1);
  const target = Math.max(15, Math.min(30, Number(input.targetDurationSeconds) || 20));
  let outputCursor = 0;
  const cuts: GeminiSelectedCut[] = [];

  for (const item of Array.isArray(parsed.recommendedCuts) ? parsed.recommendedCuts.slice(0, 12) : []) {
    if (outputCursor >= target - .7) break;
    const start = clamp(item.sourceStartSecond, 0, Math.max(0, sourceDuration - .7));
    const requestedEnd = clamp(item.sourceEndSecond, start + .7, sourceDuration);
    const duration = Math.min(2.5, Math.max(.7, requestedEnd - start), target - outputCursor);
    if (duration < .7) continue;
    cuts.push({
      order: cuts.length + 1,
      frameIndex: Math.max(1, Math.min(frames.length, Math.round(Number(item.frameIndex) || 1))),
      sourceStartSecond: Number(start.toFixed(2)),
      sourceEndSecond: Number((start + duration).toFixed(2)),
      durationSeconds: Number(duration.toFixed(2)),
      score: Math.round(clamp(item.score, 0, 100)),
      role: String(item.role || (cuts.length ? "제품 사용·혜택" : "첫 2초 훅")).slice(0, 80),
      reason: String(item.reason || "제품이 명확하게 보이는 구간").slice(0, 240),
      subtitleSuggestion: String(item.subtitleSuggestion || "제품 핵심을 확인하세요").slice(0, 80),
    });
    outputCursor += duration;
  }

  const fallbackTimes = input.frameTimestamps.slice(0, frames.length).map(Number).filter((value) => Number.isFinite(value));
  let fallbackIndex = 0;
  while (outputCursor < target - .7 && cuts.length < 12 && fallbackTimes.length) {
    const timestamp = fallbackTimes[fallbackIndex % fallbackTimes.length];
    fallbackIndex += 1;
    const duration = Math.min(2.2, target - outputCursor);
    if (duration < .7) break;
    const start = clamp(timestamp - duration / 2, 0, Math.max(0, sourceDuration - duration));
    const duplicate = cuts.some((cut) => Math.abs(cut.sourceStartSecond - start) < .35);
    if (duplicate && fallbackIndex < fallbackTimes.length * 2) continue;
    cuts.push({
      order: cuts.length + 1,
      frameIndex: Math.max(1, Math.min(frames.length, (fallbackIndex - 1) % frames.length + 1)),
      sourceStartSecond: Number(start.toFixed(2)),
      sourceEndSecond: Number((start + duration).toFixed(2)),
      durationSeconds: Number(duration.toFixed(2)),
      score: 70,
      role: cuts.length ? "제품 사용·디테일 연결" : "첫 2초 훅",
      reason: "목표 영상 길이에 맞추기 위해 선명한 분석 프레임 주변 구간을 보완 선택했습니다.",
      subtitleSuggestion: cuts.length ? "사용 장면을 확인하세요" : "이 장면부터 보세요",
    });
    outputCursor += duration;
  }

  if (!cuts.length) throw new Error("Gemini가 사용할 수 있는 영상 구간을 선택하지 못했습니다.");

  const result: GeminiMediaAnalysis = {
    summary: String(parsed.summary || "Gemini가 제품 노출과 영상 품질을 기준으로 추천 구간을 선택했습니다.").slice(0, 1200),
    productMatchScore: Math.round(clamp(parsed.productMatchScore, 0, 100)),
    visualQualityScore: Math.round(clamp(parsed.visualQualityScore, 0, 100)),
    bestHookTimestamp: Number(clamp(parsed.bestHookTimestamp, 0, sourceDuration).toFixed(2)),
    recommendedCuts: cuts,
    rejectedMoments: Array.isArray(parsed.rejectedMoments) ? parsed.rejectedMoments.map(String).slice(0, 8) : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String).slice(0, 8) : [],
    model,
    analyzedAt: new Date().toISOString(),
  };
  return result;
}
