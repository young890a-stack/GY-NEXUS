import OpenAI from "openai";

export type V34VariantKey = "A" | "B" | "C";
export type V34VariantType = "problem-solution" | "visual-surprise" | "comparison-proof";

export type V34ScenePlan = {
  sceneNumber: number;
  role: string;
  visualDirection: string;
  cameraDirection: string;
  narration: string;
  subtitle: string;
  proofPoint: string;
  recreateReason: string;
};

export type V34VariantPlan = {
  variantKey: V34VariantKey;
  variantType: V34VariantType;
  title: string;
  strategySummary: string;
  targetAudience: string;
  hookOptions: [string, string, string];
  voiceover: string;
  description: string;
  hashtags: string[];
  cta: string;
  thumbnailOptions: Array<{
    headline: string;
    accent: string;
    layout: "benefit-arrow" | "problem-solution" | "clean-product";
  }>;
  verifiedClaims: string[];
  cautions: string[];
  estimatedHookScore: number;
  qualityAudit: {
    approved: boolean;
    score: number;
    summary: string;
    issues: string[];
    checks: {
      claimSafety: boolean;
      originalRecreation: boolean;
      durationFit: boolean;
      productEvidenceOnly: boolean;
    };
  };
  scenes: V34ScenePlan[];
};

export type V34ProductionPlan = {
  productName: string;
  sourceSummary: string;
  variants: V34VariantPlan[];
};

type SourceSegment = {
  role?: string | null;
  start_second?: number | string | null;
  end_second?: number | string | null;
  visual_description?: string | null;
  camera_direction?: string | null;
  reusable_pattern?: string | null;
  recreate_direction?: string | null;
  hook_score?: number | null;
  proof_score?: number | null;
  copyright_risk_score?: number | null;
};

export type GenerateV34PlanInput = {
  productName: string;
  productDescription: string;
  durationSeconds: 15 | 20 | 25 | 30;
  candidateTitle: string;
  candidatePlatform: string;
  candidateSummary: string;
  candidateScore: number;
  segments: SourceSegment[];
};

const variantSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    variantKey: { type: "string", enum: ["A", "B", "C"] },
    variantType: { type: "string", enum: ["problem-solution", "visual-surprise", "comparison-proof"] },
    title: { type: "string" },
    strategySummary: { type: "string" },
    targetAudience: { type: "string" },
    hookOptions: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    voiceover: { type: "string" },
    description: { type: "string" },
    hashtags: { type: "array", minItems: 6, maxItems: 10, items: { type: "string" } },
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
    verifiedClaims: { type: "array", maxItems: 8, items: { type: "string" } },
    cautions: { type: "array", maxItems: 8, items: { type: "string" } },
    estimatedHookScore: { type: "number", minimum: 0, maximum: 100 },
    qualityAudit: {
      type: "object",
      additionalProperties: false,
      properties: {
        approved: { type: "boolean" },
        score: { type: "number", minimum: 0, maximum: 100 },
        summary: { type: "string" },
        issues: { type: "array", maxItems: 8, items: { type: "string" } },
        checks: {
          type: "object",
          additionalProperties: false,
          properties: {
            claimSafety: { type: "boolean" },
            originalRecreation: { type: "boolean" },
            durationFit: { type: "boolean" },
            productEvidenceOnly: { type: "boolean" },
          },
          required: ["claimSafety", "originalRecreation", "durationFit", "productEvidenceOnly"],
        },
      },
      required: ["approved", "score", "summary", "issues", "checks"],
    },
    scenes: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          sceneNumber: { type: "integer", minimum: 1, maximum: 6 },
          role: { type: "string" },
          visualDirection: { type: "string" },
          cameraDirection: { type: "string" },
          narration: { type: "string" },
          subtitle: { type: "string" },
          proofPoint: { type: "string" },
          recreateReason: { type: "string" },
        },
        required: ["sceneNumber", "role", "visualDirection", "cameraDirection", "narration", "subtitle", "proofPoint", "recreateReason"],
      },
    },
  },
  required: [
    "variantKey",
    "variantType",
    "title",
    "strategySummary",
    "targetAudience",
    "hookOptions",
    "voiceover",
    "description",
    "hashtags",
    "cta",
    "thumbnailOptions",
    "verifiedClaims",
    "cautions",
    "estimatedHookScore",
    "qualityAudit",
    "scenes",
  ],
} as const;

const productionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    productName: { type: "string" },
    sourceSummary: { type: "string" },
    variants: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: variantSchema,
    },
  },
  required: ["productName", "sourceSummary", "variants"],
} as const;

function clean(value: unknown, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanList(value: unknown, max: number, itemMax = 120) {
  return Array.isArray(value)
    ? value.map((item) => clean(item, itemMax)).filter(Boolean).slice(0, max)
    : [];
}

function clamp(value: unknown, min = 0, max = 100) {
  const number = Number(value);
  return Math.round(Math.min(max, Math.max(min, Number.isFinite(number) ? number : min)));
}

function containsUnsafeClaim(value: string) {
  return /(100%|무조건|완치|치료|즉시\s*효과|절대|최고|1위|유일|기적|보장|판매량\s*1위)/i.test(value);
}

function normalizeVariant(raw: Record<string, unknown>, expectedKey: V34VariantKey, expectedType: V34VariantType, input: GenerateV34PlanInput): V34VariantPlan {
  const sceneCount = input.durationSeconds / 5;
  const rawScenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  const scenes: V34ScenePlan[] = [];

  for (let index = 0; index < sceneCount; index += 1) {
    const scene = rawScenes[index] && typeof rawScenes[index] === "object" && !Array.isArray(rawScenes[index])
      ? rawScenes[index] as Record<string, unknown>
      : {};
    const fallbackRole = index === 0 ? "hook" : index === sceneCount - 1 ? "cta" : "product-demo";
    const narration = clean(scene.narration, 90) || (index === 0
      ? `${input.productName}, 이런 불편을 줄이는 방법부터 확인해보세요.`
      : index === sceneCount - 1
        ? "상품 정보와 사용 조건은 링크에서 확인하세요."
        : `${input.productName}의 확인된 특징을 실제 사용 흐름으로 보여줍니다.`);
    scenes.push({
      sceneNumber: index + 1,
      role: clean(scene.role, 40) || fallbackRole,
      visualDirection: clean(scene.visualDirection, 500) || `${input.productName}의 실제 형태와 색상을 유지한 세로형 상품 사용 장면`,
      cameraDirection: clean(scene.cameraDirection, 180) || "안정적인 세로형 클로즈업, 느린 카메라 이동",
      narration,
      subtitle: clean(scene.subtitle, 90) || narration,
      proofPoint: clean(scene.proofPoint, 180) || "상품 설명에서 확인된 정보만 표현",
      recreateReason: clean(scene.recreateReason, 240) || "중국 원본의 구조만 참고하고 새로운 한국형 촬영 장면으로 재창작",
    });
  }

  const hookOptions = cleanList(raw.hookOptions, 3, 70);
  while (hookOptions.length < 3) hookOptions.push(`${input.productName}, 첫 장면부터 사용 이유가 보입니다.`);
  const voiceover = clean(raw.voiceover, 1200) || scenes.map((scene) => scene.narration).join(" ");
  const combinedClaims = `${voiceover} ${clean(raw.description, 800)} ${hookOptions.join(" ")}`;
  const characterRate = voiceover.replace(/\s/g, "").length / input.durationSeconds;
  const durationFit = characterRate >= 1.5 && characterRate <= 8.5;
  const claimSafety = !containsUnsafeClaim(combinedClaims);

  const auditRaw = raw.qualityAudit && typeof raw.qualityAudit === "object" && !Array.isArray(raw.qualityAudit)
    ? raw.qualityAudit as Record<string, unknown>
    : {};
  const checksRaw = auditRaw.checks && typeof auditRaw.checks === "object" && !Array.isArray(auditRaw.checks)
    ? auditRaw.checks as Record<string, unknown>
    : {};
  const modelScore = clamp(auditRaw.score, 0, 100);
  const checks = {
    claimSafety: claimSafety && checksRaw.claimSafety === true,
    originalRecreation: checksRaw.originalRecreation === true,
    durationFit: durationFit && checksRaw.durationFit === true,
    productEvidenceOnly: checksRaw.productEvidenceOnly === true,
  };
  const issues = cleanList(auditRaw.issues, 8, 180);
  if (!claimSafety) issues.push("과장 또는 확정적 표현이 감지되었습니다.");
  if (!durationFit) issues.push("내레이션 분량이 선택한 영상 길이와 맞지 않습니다.");
  const approved = modelScore >= 88 && Object.values(checks).every(Boolean) && issues.length === 0;

  const thumbnailOptionsRaw = Array.isArray(raw.thumbnailOptions) ? raw.thumbnailOptions : [];
  const thumbnailOptions = [0, 1, 2].map((index) => {
    const item = thumbnailOptionsRaw[index] && typeof thumbnailOptionsRaw[index] === "object" && !Array.isArray(thumbnailOptionsRaw[index])
      ? thumbnailOptionsRaw[index] as Record<string, unknown>
      : {};
    const layout = ["benefit-arrow", "problem-solution", "clean-product"].includes(String(item.layout))
      ? String(item.layout) as "benefit-arrow" | "problem-solution" | "clean-product"
      : index === 0 ? "problem-solution" : index === 1 ? "benefit-arrow" : "clean-product";
    return {
      headline: clean(item.headline, 40) || input.productName,
      accent: clean(item.accent, 25) || (index === 0 ? "불편 해결" : index === 1 ? "사용 장면" : "핵심 비교"),
      layout,
    };
  });

  return {
    variantKey: expectedKey,
    variantType: expectedType,
    title: clean(raw.title, 100) || `${input.productName} ${expectedKey}형 쇼츠`,
    strategySummary: clean(raw.strategySummary, 400),
    targetAudience: clean(raw.targetAudience, 150) || "20~40대 모바일 쇼핑 사용자",
    hookOptions: [hookOptions[0], hookOptions[1], hookOptions[2]],
    voiceover,
    description: clean(raw.description, 800),
    hashtags: cleanList(raw.hashtags, 10, 35).map((tag) => tag.startsWith("#") ? tag : `#${tag}`),
    cta: clean(raw.cta, 120) || "상품 정보는 프로필 링크에서 확인하세요.",
    thumbnailOptions,
    verifiedClaims: cleanList(raw.verifiedClaims, 8, 160),
    cautions: cleanList(raw.cautions, 8, 160),
    estimatedHookScore: clamp(raw.estimatedHookScore, 0, 100),
    qualityAudit: {
      approved,
      score: modelScore,
      summary: clean(auditRaw.summary, 400),
      issues: Array.from(new Set(issues)).slice(0, 8),
      checks,
    },
    scenes,
  };
}

export function getV34PlanningModel() {
  return process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_MODEL || "gpt-5.6";
}

export async function generateV34ProductionPlan(input: GenerateV34PlanInput): Promise<V34ProductionPlan> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
  const sceneCount = input.durationSeconds / 5;
  const sourceSegments = input.segments.slice(0, 16).map((segment, index) => ({
    index: index + 1,
    role: clean(segment.role, 60),
    seconds: `${Number(segment.start_second || 0).toFixed(1)}-${Number(segment.end_second || 0).toFixed(1)}`,
    visual: clean(segment.visual_description, 240),
    camera: clean(segment.camera_direction, 160),
    reusablePattern: clean(segment.reusable_pattern, 180),
    recreateDirection: clean(segment.recreate_direction, 220),
    hookScore: clamp(segment.hook_score),
    proofScore: clamp(segment.proof_score),
    copyrightRiskScore: clamp(segment.copyright_risk_score),
  }));

  const prompt = [
    "당신은 GY-NEXUS의 한국 쇼핑 쇼츠 총괄 제작 감독이다.",
    `상품명: ${input.productName}`,
    `확인된 상품 설명: ${input.productDescription}`,
    `목표 영상 길이: ${input.durationSeconds}초, 정확히 ${sceneCount}개 장면, 장면당 5초`,
    `참고 후보: ${input.candidatePlatform} · ${input.candidateTitle} · 분석점수 ${input.candidateScore}`,
    `후보 분석 요약: ${input.candidateSummary}`,
    `V3-3 장면 구조 데이터: ${JSON.stringify(sourceSegments)}`,
    "A는 문제 해결형, B는 시각 충격형, C는 비교 증명형으로 서로 확실히 다르게 만든다.",
    "중국 원본의 구도·자막·대사·인물·음악·워터마크를 복사하지 않는다. 성공 구조와 장면 역할만 배우고 완전히 새로운 한국형 촬영 장면을 설계한다.",
    "모든 시각 장면은 제공될 실제 상품 사진의 외형·색상·재질·버튼·포트·로고를 그대로 유지할 수 있는 현실적이고 단순한 동작이어야 한다.",
    "상품 설명에 없는 효능, 수치, 판매량, 순위, 직접 사용 경험을 만들지 않는다. 100%, 무조건, 최고, 1위, 보장 같은 표현을 쓰지 않는다.",
    "첫 장면은 2초 안에 이해되는 훅이어야 하고, 마지막은 강요하지 않는 확인형 CTA로 끝낸다.",
    "내레이션은 20~40대가 자연스럽게 듣는 한국어로 작성하고 선택한 길이에 실제로 읽을 수 있는 분량으로 제한한다.",
    "각 variant의 scenes 배열은 반드시 정확히 지정된 장면 수를 지킨다.",
    "qualityAudit은 독립 검수자처럼 엄격하게 작성한다. 문제가 하나라도 있으면 approved=false로 둔다.",
  ].join("\n");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: getV34PlanningModel(),
    reasoning: { effort: "medium" },
    input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
    text: { format: { type: "json_schema", name: "gy_v34_production_plan", strict: true, schema: productionSchema } },
    max_output_tokens: 9000,
  });
  const parsed = JSON.parse(response.output_text || "{}") as Record<string, unknown>;
  const rawVariants = Array.isArray(parsed.variants) ? parsed.variants : [];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const item of rawVariants) {
    if (item && typeof item === "object" && !Array.isArray(item)) byKey.set(String((item as Record<string, unknown>).variantKey), item as Record<string, unknown>);
  }
  const variants = [
    normalizeVariant(byKey.get("A") || {}, "A", "problem-solution", input),
    normalizeVariant(byKey.get("B") || {}, "B", "visual-surprise", input),
    normalizeVariant(byKey.get("C") || {}, "C", "comparison-proof", input),
  ];

  return {
    productName: clean(parsed.productName, 160) || input.productName,
    sourceSummary: clean(parsed.sourceSummary, 700) || input.candidateSummary,
    variants,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function calculateV34Quality(input: {
  project: Record<string, unknown>;
  scenes: Array<Record<string, unknown>>;
  planScore: number;
  threshold: number;
}) {
  const settings = record(input.project.settings);
  const commerce = record(settings.commercePackage);
  const audit = record(commerce.qualityAudit);
  const cues = Array.isArray(commerce.subtitleCues) ? commerce.subtitleCues.map(record) : [];
  const voiceover = clean(commerce.voiceover, 5000);
  const cueText = cues.map((cue) => clean(cue.text, 500)).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const subtitleExact = Boolean(voiceover && cueText === voiceover);
  const contentApproved = Boolean(settings.contentApprovedAt);
  const voiceReady = Boolean(settings.voiceAudioUrl);
  const mediaReferences = Array.isArray(settings.mediaReferences) ? settings.mediaReferences.map(record) : [];
  const rightsSafe = !mediaReferences.some((item) => item.useInFinal === true && String(item.rightsStatus || "unverified") === "unverified");
  const sceneCount = input.scenes.length;
  const imageApproved = input.scenes.filter((scene) => scene.quality_status === "approved").length;
  const clipsCompleted = input.scenes.filter((scene) => scene.status === "completed" && scene.video_url).length;
  const finalVideoReady = Boolean(input.project.final_video_url);
  const imageScores = input.scenes.map((scene) => Number(scene.quality_score) || 0).filter((score) => score > 0);
  const averageImageScore = imageScores.length ? imageScores.reduce((sum, score) => sum + score, 0) / imageScores.length : 0;
  const productScores = input.scenes.map((scene) => {
    const report = record(scene.quality_report);
    const metrics = record(report.metrics);
    return Number(metrics.productMatch) || Number(scene.quality_score) || 0;
  }).filter((score) => score > 0);
  const averageProductMatch = productScores.length ? productScores.reduce((sum, score) => sum + score, 0) / productScores.length : 0;
  const scriptScore = Math.max(0, Math.min(100, Number(audit.score) || input.planScore || 0));
  const hookScore = Math.max(0, Math.min(100, input.planScore || 0));
  const completionScore = sceneCount > 0
    ? ((clipsCompleted / sceneCount) * 50 + (finalVideoReady ? 50 : 0))
    : 0;
  const policyScore = contentApproved && rightsSafe && audit.approved === true ? 100 : 0;

  const components = {
    hook: Number((hookScore * .15).toFixed(2)),
    productMatch: Number((averageProductMatch * .15).toFixed(2)),
    visualQuality: Number((averageImageScore * .15).toFixed(2)),
    script: Number((scriptScore * .15).toFixed(2)),
    subtitles: subtitleExact ? 10 : 0,
    voice: voiceReady ? 10 : 0,
    completion: Number((completionScore * .10).toFixed(2)),
    policy: Number((policyScore * .10).toFixed(2)),
  };
  const score = Math.round(Object.values(components).reduce((sum, value) => sum + value, 0));
  const criticalErrors: string[] = [];
  if (!contentApproved) criticalErrors.push("대표 콘텐츠 승인이 없습니다.");
  if (!rightsSafe) criticalErrors.push("권리 미확인 소재가 최종 사용으로 선택되었습니다.");
  if (imageApproved !== sceneCount || sceneCount === 0) criticalErrors.push("모든 장면 이미지가 품질검수를 통과하지 않았습니다.");
  if (clipsCompleted !== sceneCount || sceneCount === 0) criticalErrors.push("모든 Runway 장면이 완성되지 않았습니다.");
  if (!subtitleExact) criticalErrors.push("AI 음성 대본과 SRT 자막이 정확히 일치하지 않습니다.");
  if (!voiceReady) criticalErrors.push("한국어 AI 음성이 없습니다.");
  if (!finalVideoReady) criticalErrors.push("최종 MP4가 없습니다.");
  if (averageProductMatch > 0 && averageProductMatch < 80) criticalErrors.push("상품 일치도 평균이 80점 미만입니다.");
  if (averageImageScore > 0 && averageImageScore < 80) criticalErrors.push("장면 이미지 품질 평균이 80점 미만입니다.");
  const passed = score >= input.threshold && criticalErrors.length === 0;

  return {
    score,
    threshold: input.threshold,
    passed,
    components,
    metrics: {
      hookScore: Math.round(hookScore),
      averageProductMatch: Math.round(averageProductMatch),
      averageImageScore: Math.round(averageImageScore),
      scriptScore: Math.round(scriptScore),
      imageApproved,
      clipsCompleted,
      sceneCount,
      subtitleExact,
      voiceReady,
      finalVideoReady,
      rightsSafe,
      contentApproved,
    },
    criticalErrors,
    summary: passed
      ? `종합 ${score}점으로 V3-4 품질 기준을 통과했습니다.`
      : `종합 ${score}점입니다. ${criticalErrors[0] || "품질 기준을 보강해주세요."}`,
  };
}

export function formatSrtTime(seconds: number) {
  const totalMilliseconds = Math.max(0, Math.round(Number(seconds || 0) * 1000));
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const secs = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}
