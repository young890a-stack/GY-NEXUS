import OpenAI from "openai";
import type { GeneratedImageCandidate } from "@/lib/creative-studio/types";
import type {
  ProductVisualProfile,
  SceneImageCandidate,
  SceneQualityReport,
} from "./types";

type CandidateAssessment = {
  index: number;
  product_match: number;
  visual_integrity: number;
  geometry_detail: number;
  color_material: number;
  text_logo_integrity: number;
  human_anatomy: number;
  scene_continuity: number;
  motion_readiness: number;
  commercial_naturalness: number;
  composition: number;
  claim_safety: number;
  issues: string[];
  critical_errors: string[];
  recommendation: "approve" | "revise" | "reject";
};

type QualityPayload = {
  candidates: CandidateAssessment[];
  summary: string;
};

const profileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    identitySummary: { type: "string" },
    category: { type: "string" },
    dominantColors: { type: "array", items: { type: "string" } },
    materials: { type: "array", items: { type: "string" } },
    silhouette: { type: "string" },
    distinctiveFeatures: { type: "array", items: { type: "string" } },
    controlsAndPorts: { type: "array", items: { type: "string" } },
    visibleBranding: { type: "array", items: { type: "string" } },
    includedAccessories: { type: "array", items: { type: "string" } },
    forbiddenChanges: { type: "array", items: { type: "string" } },
    referenceCoverageScore: { type: "integer", minimum: 0, maximum: 100 },
    referenceGaps: { type: "array", items: { type: "string" } },
  },
  required: [
    "identitySummary",
    "category",
    "dominantColors",
    "materials",
    "silhouette",
    "distinctiveFeatures",
    "controlsAndPorts",
    "visibleBranding",
    "includedAccessories",
    "forbiddenChanges",
    "referenceCoverageScore",
    "referenceGaps",
  ],
} as const;

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
          geometry_detail: { type: "integer", minimum: 0, maximum: 100 },
          color_material: { type: "integer", minimum: 0, maximum: 100 },
          text_logo_integrity: { type: "integer", minimum: 0, maximum: 100 },
          human_anatomy: { type: "integer", minimum: 0, maximum: 100 },
          scene_continuity: { type: "integer", minimum: 0, maximum: 100 },
          motion_readiness: { type: "integer", minimum: 0, maximum: 100 },
          commercial_naturalness: { type: "integer", minimum: 0, maximum: 100 },
          composition: { type: "integer", minimum: 0, maximum: 100 },
          claim_safety: { type: "integer", minimum: 0, maximum: 100 },
          issues: { type: "array", items: { type: "string" } },
          critical_errors: { type: "array", items: { type: "string" } },
          recommendation: { type: "string", enum: ["approve", "revise", "reject"] },
        },
        required: [
          "index",
          "product_match",
          "visual_integrity",
          "geometry_detail",
          "color_material",
          "text_logo_integrity",
          "human_anatomy",
          "scene_continuity",
          "motion_readiness",
          "commercial_naturalness",
          "composition",
          "claim_safety",
          "issues",
          "critical_errors",
          "recommendation",
        ],
      },
    },
    summary: { type: "string" },
  },
  required: ["candidates", "summary"],
} as const;

const clamp = (value: unknown) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const strings = (value: unknown, limit = 12) =>
  Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, limit) : [];

function totalScore(item: CandidateAssessment) {
  return clamp(
    clamp(item.product_match) * 0.22 +
      clamp(item.visual_integrity) * 0.1 +
      clamp(item.geometry_detail) * 0.12 +
      clamp(item.color_material) * 0.1 +
      clamp(item.text_logo_integrity) * 0.1 +
      clamp(item.human_anatomy) * 0.08 +
      clamp(item.scene_continuity) * 0.08 +
      clamp(item.motion_readiness) * 0.08 +
      clamp(item.commercial_naturalness) * 0.05 +
      clamp(item.composition) * 0.04 +
      clamp(item.claim_safety) * 0.03,
  );
}

export function formatProductVisualLock(profile: ProductVisualProfile) {
  return [
    `상품 정체성: ${profile.identitySummary}`,
    `카테고리: ${profile.category}`,
    `고정 색상: ${profile.dominantColors.join(", ") || "참조 이미지 그대로"}`,
    `고정 재질: ${profile.materials.join(", ") || "참조 이미지 그대로"}`,
    `고정 실루엣·비율: ${profile.silhouette}`,
    `식별 특징: ${profile.distinctiveFeatures.join(" · ") || "참조 이미지 그대로"}`,
    `버튼·포트·구조: ${profile.controlsAndPorts.join(" · ") || "보이는 구조를 임의로 추가하지 않음"}`,
    `보이는 로고·글자: ${profile.visibleBranding.join(" · ") || "새 로고나 글자를 만들지 않음"}`,
    `구성품: ${profile.includedAccessories.join(" · ") || "확인되지 않은 구성품을 만들지 않음"}`,
    `절대 변경 금지: ${profile.forbiddenChanges.join(" · ")}`,
  ].join("\n");
}

export async function analyzeProductVisualProfile(input: {
  productName: string;
  productDescription: string;
  referenceImageUrls: string[];
}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
  if (input.referenceImageUrls.length < 1) {
    throw new Error("상품 동일성 분석을 위해 실제 상품 사진이 최소 1장 필요합니다.");
  }

  const model = process.env.OPENAI_QUALITY_MODEL || process.env.OPENAI_STRATEGY_MODEL || "gpt-5.6-sol";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "original" }
  > = [{
    type: "input_text",
    text: [
      "당신은 상업용 제품 촬영의 상품 정체성 분석관이다.",
      `상품명: ${input.productName}`,
      `검증된 설명: ${input.productDescription || "설명 없음"}`,
      "이어지는 실제 상품 사진만 사실 기준으로 사용한다.",
      input.referenceImageUrls.length === 1
        ? "사진 한 장에서 실제로 보이는 색상, 재질, 실루엣, 버튼, 포트, 로고와 구성품만 추출한다. 보이지 않는 뒤·옆면은 추측하지 않는다."
        : "여러 사진에 공통으로 확인되는 색상, 재질, 실루엣, 버튼, 포트, 로고, 구성품을 추출한다.",
      "사진에서 확인할 수 없는 내용은 추측하지 말고 referenceGaps에 기록한다.",
      "forbiddenChanges에는 AI가 바꾸면 다른 상품이 되는 핵심 특징을 구체적으로 적는다.",
      "서로 다른 각도와 세부 구조를 판별하기 충분한지 referenceCoverageScore를 엄격히 평가한다.",
    ].join("\n"),
  }];
  input.referenceImageUrls.slice(0, 4).forEach((url, index) => {
    content.push({ type: "input_text", text: `PRODUCT FACT PHOTO ${index + 1}` });
    content.push({ type: "input_image", image_url: url, detail: "original" });
  });

  const response = await openai.responses.create({
    model,
    reasoning: { effort: "high" },
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "gy_product_visual_profile",
        strict: true,
        schema: profileSchema,
      },
    },
    max_output_tokens: 2200,
  });
  const raw = response.output_text?.trim();
  if (!raw) throw new Error("상품 시각 정체성 분석 결과가 비어 있습니다.");
  const parsed = JSON.parse(raw) as ProductVisualProfile;
  const profile: ProductVisualProfile = {
    identitySummary: String(parsed.identitySummary || input.productName),
    category: String(parsed.category || "상품"),
    dominantColors: strings(parsed.dominantColors),
    materials: strings(parsed.materials),
    silhouette: String(parsed.silhouette || "참조 이미지와 동일한 실루엣과 비율"),
    distinctiveFeatures: strings(parsed.distinctiveFeatures),
    controlsAndPorts: strings(parsed.controlsAndPorts),
    visibleBranding: strings(parsed.visibleBranding),
    includedAccessories: strings(parsed.includedAccessories),
    forbiddenChanges: strings(parsed.forbiddenChanges),
    referenceCoverageScore: clamp(parsed.referenceCoverageScore),
    referenceGaps: strings(parsed.referenceGaps),
  };
  return { model, profile };
}

export async function reviewSceneImageCandidates(input: {
  productName: string;
  productDescription: string;
  scenePrompt: string;
  visualProfile: ProductVisualProfile;
  referenceImageUrls: string[];
  continuityImageUrls?: string[];
  candidates: GeneratedImageCandidate[];
  threshold: number;
}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
  if (input.referenceImageUrls.length < 1 || !input.candidates.length) {
    throw new Error("품질검수에는 실제 상품 사진 1장 이상과 후보 이미지가 필요합니다.");
  }

  const model = process.env.OPENAI_QUALITY_MODEL || process.env.OPENAI_STRATEGY_MODEL || "gpt-5.6-sol";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const hasContinuityAnchor = Boolean(input.continuityImageUrls?.length);
  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "original" }
  > = [
    {
      type: "input_text",
      text: [
        "당신은 GY-NEXUS 유료 쇼핑 쇼츠의 독립 시각 품질검수관이다.",
        `상품명: ${input.productName}`,
        `검증된 상품 설명: ${input.productDescription || "설명 없음"}`,
        `장면 지시: ${input.scenePrompt}`,
        "아래 PRODUCT VISUAL LOCK과 PRODUCT REFERENCE 이미지는 실제 상품의 절대 사실 기준이다.",
        formatProductVisualLock(input.visualProfile),
        hasContinuityAnchor
          ? "CONTINUITY ANCHOR는 직전 승인 장면이다. 동일 상품·인물·조명·색감이 자연스럽게 이어지는지 평가한다."
          : "첫 장면이므로 scene_continuity는 제품과 스타일이 내부적으로 일관되면 100점으로 평가한다.",
        "상품 색상·형태·재질·구성품·비율·버튼·포트 중 하나라도 바뀌면 product_match와 geometry_detail을 크게 감점한다.",
        "가짜 글자, 변형된 로고, 추가 버튼·포트·구성품, 손가락·관절 오류, 제품이 녹거나 휘는 형태는 critical_errors에 기록한다.",
        "motion_readiness는 5초 영상의 첫 프레임으로 움직여도 제품 형태가 안정적으로 유지될 단순하고 명확한 장면인지 평가한다.",
        "평균적인 예쁨보다 실제 상품 동일성과 영상 안정성을 우선한다. 의심스러우면 approve하지 않는다.",
      ].join("\n"),
    },
  ];

  input.referenceImageUrls.slice(0, 4).forEach((url, index) => {
    content.push({ type: "input_text", text: `PRODUCT REFERENCE ${index + 1}` });
    content.push({ type: "input_image", image_url: url, detail: "original" });
  });
  input.continuityImageUrls?.slice(0, 1).forEach((url) => {
    content.push({ type: "input_text", text: "CONTINUITY ANCHOR · 직전 승인 장면" });
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
        name: "gy_scene_image_quality_v2",
        strict: true,
        schema: qualitySchema,
      },
    },
    max_output_tokens: 3400,
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
      geometry_detail: 0,
      color_material: 0,
      text_logo_integrity: 0,
      human_anatomy: 0,
      scene_continuity: 0,
      motion_readiness: 0,
      commercial_naturalness: 0,
      composition: 0,
      claim_safety: 0,
      issues: ["검수 결과 누락"],
      critical_errors: ["후보 검수 결과가 누락됨"],
      recommendation: "reject",
    };
    return { candidate, assessment, score: totalScore(assessment) };
  });
  assessments.sort((a, b) => b.score - a.score);
  const best = assessments[0];
  if (!best) throw new Error("평가할 이미지 후보가 없습니다.");

  const criticalErrors = strings(best.assessment.critical_errors, 10);
  const issues = Array.from(new Set([...criticalErrors, ...strings(best.assessment.issues, 12)])).slice(0, 12);
  const hardGateApproved =
    clamp(best.assessment.product_match) >= input.threshold &&
    clamp(best.assessment.visual_integrity) >= 82 &&
    clamp(best.assessment.geometry_detail) >= 82 &&
    clamp(best.assessment.color_material) >= 82 &&
    clamp(best.assessment.text_logo_integrity) >= 88 &&
    clamp(best.assessment.human_anatomy) >= 82 &&
    (!hasContinuityAnchor || clamp(best.assessment.scene_continuity) >= 82) &&
    clamp(best.assessment.motion_readiness) >= 82 &&
    clamp(best.assessment.claim_safety) >= 85 &&
    criticalErrors.length === 0;
  const report: SceneQualityReport = {
    provider: "openai",
    model,
    threshold: input.threshold,
    score: best.score,
    approved:
      best.score >= input.threshold &&
      hardGateApproved &&
      best.assessment.recommendation === "approve",
    summary: String(payload.summary || "시각 품질검수가 완료되었습니다."),
    issues,
    criticalErrors,
    metrics: {
      productMatch: clamp(best.assessment.product_match),
      visualIntegrity: clamp(best.assessment.visual_integrity),
      geometryDetail: clamp(best.assessment.geometry_detail),
      colorMaterial: clamp(best.assessment.color_material),
      textLogoIntegrity: clamp(best.assessment.text_logo_integrity),
      humanAnatomy: clamp(best.assessment.human_anatomy),
      sceneContinuity: clamp(best.assessment.scene_continuity),
      motionReadiness: clamp(best.assessment.motion_readiness),
      commercialNaturalness: clamp(best.assessment.commercial_naturalness),
      composition: clamp(best.assessment.composition),
      claimSafety: clamp(best.assessment.claim_safety),
    },
  };
  const candidates: SceneImageCandidate[] = assessments.map(({ candidate, assessment, score }) => ({
    ...candidate,
    score,
    issues: Array.from(new Set([...strings(assessment.critical_errors), ...strings(assessment.issues)])).slice(0, 10),
  }));

  return { model, best: best.candidate, report, candidates };
}
