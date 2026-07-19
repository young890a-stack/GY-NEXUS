import OpenAI from "openai";
import type { GeneratedImageCandidate } from "@/lib/creative-studio/types";
import type { SceneImageCandidate, SceneQualityReport } from "./types";

type CandidateAssessment = {
  index: number;
  product_match: number;
  visual_integrity: number;
  commercial_naturalness: number;
  composition: number;
  claim_safety: number;
  issues: string[];
  recommendation: "approve" | "revise" | "reject";
};

type QualityPayload = {
  candidates: CandidateAssessment[];
  summary: string;
};

const qualitySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          product_match: { type: "integer", minimum: 0, maximum: 100 },
          visual_integrity: { type: "integer", minimum: 0, maximum: 100 },
          commercial_naturalness: { type: "integer", minimum: 0, maximum: 100 },
          composition: { type: "integer", minimum: 0, maximum: 100 },
          claim_safety: { type: "integer", minimum: 0, maximum: 100 },
          issues: { type: "array", items: { type: "string" } },
          recommendation: { type: "string", enum: ["approve", "revise", "reject"] },
        },
        required: [
          "index",
          "product_match",
          "visual_integrity",
          "commercial_naturalness",
          "composition",
          "claim_safety",
          "issues",
          "recommendation",
        ],
      },
    },
    summary: { type: "string" },
  },
  required: ["candidates", "summary"],
} as const;

const clamp = (value: unknown) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

function totalScore(item: CandidateAssessment) {
  return clamp(
    clamp(item.product_match) * 0.4 +
      clamp(item.visual_integrity) * 0.2 +
      clamp(item.commercial_naturalness) * 0.15 +
      clamp(item.composition) * 0.15 +
      clamp(item.claim_safety) * 0.1,
  );
}

export async function reviewSceneImageCandidates(input: {
  productName: string;
  productDescription: string;
  scenePrompt: string;
  referenceImageUrls: string[];
  candidates: GeneratedImageCandidate[];
  threshold: number;
}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
  if (!input.referenceImageUrls.length || !input.candidates.length) {
    throw new Error("품질검수에 필요한 참조 이미지와 후보 이미지가 없습니다.");
  }

  const model = process.env.OPENAI_QUALITY_MODEL || process.env.OPENAI_STRATEGY_MODEL || "gpt-5.6-sol";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "original" }
  > = [
    {
      type: "input_text",
      text: [
        "당신은 GY-NEXUS 쇼핑 쇼츠의 독립 시각 품질검수관이다.",
        `상품명: ${input.productName}`,
        `검증된 상품 설명: ${input.productDescription || "설명 없음"}`,
        `장면 지시: ${input.scenePrompt}`,
        "먼저 제공되는 PRODUCT REFERENCE 이미지들은 실제 상품의 사실 기준이다.",
        "그 뒤 CANDIDATE 이미지를 각각 평가한다.",
        "상품 색상·형태·재질·구성품·비율 일치, 손·신체·텍스트·로고 왜곡, 과장된 크기나 효능 암시, 9:16 광고 구도, 실제 촬영 같은 자연스러움을 엄격히 확인한다.",
        "보이지 않는 효능을 추측하지 말고 작은 외형 차이도 issues에 구체적으로 적는다.",
      ].join("\n"),
    },
  ];

  input.referenceImageUrls.slice(0, 4).forEach((url, index) => {
    content.push({ type: "input_text", text: `PRODUCT REFERENCE ${index + 1}` });
    content.push({ type: "input_image", image_url: url, detail: "original" });
  });
  input.candidates.forEach((candidate, index) => {
    content.push({ type: "input_text", text: `CANDIDATE ${index} · JSON index는 ${index}` });
    content.push({ type: "input_image", image_url: candidate.assetUrl, detail: "original" });
  });

  const response = await openai.responses.create({
    model,
    reasoning: { effort: "high" },
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "gy_scene_image_quality",
        strict: true,
        schema: qualitySchema,
      },
    },
    max_output_tokens: 2500,
  });
  const raw = response.output_text?.trim();
  if (!raw) throw new Error("이미지 품질검수 결과가 비어 있습니다.");
  const payload = JSON.parse(raw) as QualityPayload;

  const assessments = input.candidates.map((candidate, index) => {
    const rawAssessment = payload.candidates.find((item) => item.index === index) || payload.candidates[index];
    const assessment: CandidateAssessment = rawAssessment || {
      index,
      product_match: 0,
      visual_integrity: 0,
      commercial_naturalness: 0,
      composition: 0,
      claim_safety: 0,
      issues: ["검수 결과 누락"],
      recommendation: "reject",
    };
    return { candidate, assessment, score: totalScore(assessment) };
  });
  assessments.sort((a, b) => b.score - a.score);
  const best = assessments[0];
  if (!best) throw new Error("평가할 이미지 후보가 없습니다.");

  const issues = Array.isArray(best.assessment.issues)
    ? best.assessment.issues.map(String).filter(Boolean).slice(0, 8)
    : [];
  const report: SceneQualityReport = {
    provider: "openai",
    model,
    threshold: input.threshold,
    score: best.score,
    approved: best.score >= input.threshold && best.assessment.recommendation === "approve",
    summary: String(payload.summary || "시각 품질검수가 완료되었습니다."),
    issues,
    metrics: {
      productMatch: clamp(best.assessment.product_match),
      visualIntegrity: clamp(best.assessment.visual_integrity),
      commercialNaturalness: clamp(best.assessment.commercial_naturalness),
      composition: clamp(best.assessment.composition),
      claimSafety: clamp(best.assessment.claim_safety),
    },
  };
  const candidates: SceneImageCandidate[] = assessments.map(({ candidate, assessment, score }) => ({
    ...candidate,
    score,
    issues: Array.isArray(assessment.issues) ? assessment.issues.map(String).slice(0, 8) : [],
  }));

  return { model, best: best.candidate, report, candidates };
}
