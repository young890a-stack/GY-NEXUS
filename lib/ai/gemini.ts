import { GoogleGenAI } from "@google/genai";

export type GeminiStrategyReview = {
  score: number;
  summary: string;
  risks: string[];
  corrections: string[];
  recommendation: "approve" | "revise" | "hold";
};

const reviewSchema = {
  type: "object",
  properties: {
    score: { type: "integer", description: "전략의 현실성과 안전성을 평가한 0~100 점수" },
    summary: { type: "string", description: "교차검증 핵심 요약" },
    risks: { type: "array", items: { type: "string" } },
    corrections: { type: "array", items: { type: "string" } },
    recommendation: { type: "string", enum: ["approve", "revise", "hold"] },
  },
  required: ["score", "summary", "risks", "corrections", "recommendation"],
  additionalProperties: false,
} as const;

export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || "";
}

export function isGeminiConfigured() {
  return Boolean(getGeminiApiKey());
}

export async function reviewStrategyWithGemini(input: {
  command: string;
  strategy: unknown;
}): Promise<GeminiStrategyReview | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const client = new GoogleGenAI({ apiKey });
  const interaction = await client.interactions.create({
    model: process.env.GEMINI_REVIEW_MODEL?.trim() || "gemini-3.5-flash",
    system_instruction:
      "당신은 GY의 독립 AI 감사관 Gemini다. Dream Y가 만든 전략을 그대로 동의하지 말고 사실성, 실행 가능성, 플랫폼 정책, 비용, 고객가치, 수익 과장 위험을 교차검증한다. 수익을 보장하지 않으며 수정이 필요하면 구체적으로 지적한다.",
    input: `대표 명령:\n${input.command}\n\nDream Y 전략:\n${JSON.stringify(input.strategy)}`,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: reviewSchema,
    },
  });

  const raw = interaction.output_text?.trim();
  if (!raw) throw new Error("Gemini가 교차검증 결과를 반환하지 않았습니다.");

  const parsed = JSON.parse(raw) as Partial<GeminiStrategyReview>;
  const recommendation = ["approve", "revise", "hold"].includes(String(parsed.recommendation))
    ? parsed.recommendation as GeminiStrategyReview["recommendation"]
    : "revise";

  return {
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    summary: String(parsed.summary || "Gemini 교차검증이 완료되었습니다."),
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String).slice(0, 8) : [],
    corrections: Array.isArray(parsed.corrections) ? parsed.corrections.map(String).slice(0, 8) : [],
    recommendation,
  };
}
