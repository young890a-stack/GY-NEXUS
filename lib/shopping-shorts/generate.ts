import OpenAI from "openai";
import { withStructuredJsonRetry } from "@/lib/ai/structured-json";
import { deterministicQuality, fingerprintVariant, mergeQualityReport } from "./quality";
import { scenesToPlainSubtitles, scenesToSrt } from "./srt";
import type {
  LearnedPattern,
  ProductInsight,
  QualityMetricKey,
  ShoppingShortsDuration,
  ShoppingShortsGeneration,
  ShoppingShortsProductInput,
  ShoppingShortsQualityMetrics,
  ShoppingShortsVariant,
  ShoppingShortsVariantDraft,
} from "./types";

const durations: ShoppingShortsDuration[] = [15, 20, 30];
const metricKeys: QualityMetricKey[] = [
  "firstThreeSeconds",
  "sceneConsistency",
  "productClarity",
  "koreanNaturalness",
  "subtitleAccuracy",
  "purchasePersuasion",
  "claimSafety",
  "originality",
];

type RawGeneration = {
  product: ProductInsight;
  hooks: Array<{ index: number; style: string; text: string; reason: string }>;
  variants: ShoppingShortsVariantDraft[];
};

type AuditItem = {
  variantKey: string;
  metrics: ShoppingShortsQualityMetrics;
  issues: string[];
  regenerationInstructions: string[];
};

const stringArray = { type: "array", items: { type: "string" } } as const;
const thumbnailSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    subline: { type: "string" },
    badge: { type: "string" },
    visualDirection: { type: "string" },
  },
  required: ["headline", "subline", "badge", "visualDirection"],
} as const;
const sceneSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    start: { type: "number" },
    end: { type: "number" },
    visual: { type: "string" },
    narration: { type: "string" },
    subtitle: { type: "string" },
    productVisible: { type: "boolean" },
  },
  required: ["start", "end", "visual", "narration", "subtitle", "productVisible"],
} as const;
const variantSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    variantKey: { type: "string" },
    hookIndex: { type: "integer", minimum: 1, maximum: 3 },
    hookStyle: { type: "string" },
    duration: { type: "integer", enum: [15, 20, 30] },
    hook: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    hashtags: { type: "array", minItems: 4, maxItems: 12, items: { type: "string" } },
    script: { type: "string" },
    cta: { type: "string" },
    thumbnail: thumbnailSchema,
    scenes: { type: "array", minItems: 3, maxItems: 10, items: sceneSchema },
  },
  required: [
    "variantKey", "hookIndex", "hookStyle", "duration", "hook", "title", "description",
    "hashtags", "script", "cta", "thumbnail", "scenes",
  ],
} as const;
const generationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    product: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        keyFeatures: stringArray,
        reviewInsights: stringArray,
        painPoints: stringArray,
        targetAudience: { type: "string" },
        sellingPoints: stringArray,
        cautions: stringArray,
      },
      required: ["summary", "keyFeatures", "reviewInsights", "painPoints", "targetAudience", "sellingPoints", "cautions"],
    },
    hooks: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer", minimum: 1, maximum: 3 },
          style: { type: "string" },
          text: { type: "string" },
          reason: { type: "string" },
        },
        required: ["index", "style", "text", "reason"],
      },
    },
    variants: { type: "array", minItems: 9, maxItems: 9, items: variantSchema },
  },
  required: ["product", "hooks", "variants"],
} as const;
const metricsSchema = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(metricKeys.map((key) => [key, { type: "integer", minimum: 0, maximum: 100 }])),
  required: metricKeys,
} as const;
const auditSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    audits: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          variantKey: { type: "string" },
          metrics: metricsSchema,
          issues: { type: "array", maxItems: 10, items: { type: "string" } },
          regenerationInstructions: { type: "array", maxItems: 10, items: { type: "string" } },
        },
        required: ["variantKey", "metrics", "issues", "regenerationInstructions"],
      },
    },
  },
  required: ["audits"],
} as const;
const revisionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    variants: { type: "array", items: variantSchema },
  },
  required: ["variants"],
} as const;

const clean = (value: unknown, limit = 800) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
const cleanArray = (value: unknown, limit = 12) => Array.isArray(value)
  ? value.map((item) => clean(item, 300)).filter(Boolean).slice(0, limit)
  : [];
const clampMetric = (value: unknown) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

function modelName() {
  return process.env.OPENAI_STRATEGY_MODEL
    || process.env.OPENAI_MODEL
    || process.env.OPENAI_QUALITY_MODEL
    || "gpt-5.6-sol";
}

function validCombinations(variants: ShoppingShortsVariantDraft[]) {
  const keys = new Set(variants.map((variant) => `${variant.hookIndex}-${variant.duration}`));
  return keys.size === 9 && [1, 2, 3].every((hook) => durations.every((duration) => keys.has(`${hook}-${duration}`)));
}

function normalizeScenes(raw: ShoppingShortsVariantDraft["scenes"], duration: ShoppingShortsDuration) {
  const usable = (Array.isArray(raw) ? raw : []).slice(0, 10);
  if (usable.length < 3) throw new Error(`${duration}초 버전의 장면이 부족합니다.`);
  const weights = usable.map((scene) => Math.max(0.7, Number(scene.end) - Number(scene.start) || clean(scene.narration).length / 13));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return usable.map((scene, index) => {
    const start = Number(cursor.toFixed(2));
    cursor = index === usable.length - 1 ? duration : cursor + duration * weights[index] / totalWeight;
    const end = Number(cursor.toFixed(2));
    return {
      start,
      end,
      visual: clean(scene.visual, 500),
      narration: clean(scene.narration, 260),
      subtitle: clean(scene.subtitle || scene.narration, 100),
      productVisible: Boolean(scene.productVisible),
    };
  });
}

function normalizeVariant(raw: ShoppingShortsVariantDraft): ShoppingShortsVariantDraft {
  const hookIndex = Math.max(1, Math.min(3, Math.round(Number(raw.hookIndex)))) as 1 | 2 | 3;
  const duration = durations.includes(Number(raw.duration) as ShoppingShortsDuration)
    ? Number(raw.duration) as ShoppingShortsDuration
    : 20;
  const scenes = normalizeScenes(raw.scenes, duration);
  const script = scenes.map((scene) => scene.narration).join(" ");
  return {
    variantKey: `H${hookIndex}-${duration}`,
    hookIndex,
    hookStyle: clean(raw.hookStyle, 80),
    duration,
    hook: clean(raw.hook, 120),
    title: clean(raw.title, 100),
    description: clean(raw.description, 1000),
    hashtags: cleanArray(raw.hashtags, 12).map((tag) => tag.startsWith("#") ? tag : `#${tag}`),
    script,
    cta: clean(raw.cta, 160),
    thumbnail: {
      headline: clean(raw.thumbnail?.headline, 40),
      subline: clean(raw.thumbnail?.subline, 60),
      badge: clean(raw.thumbnail?.badge, 24),
      visualDirection: clean(raw.thumbnail?.visualDirection, 300),
    },
    scenes,
  };
}

function normalizedMetrics(value: Partial<ShoppingShortsQualityMetrics> | undefined) {
  return Object.fromEntries(metricKeys.map((key) => [key, clampMetric(value?.[key])])) as ShoppingShortsQualityMetrics;
}

function learnedPrompt(patterns: LearnedPattern[]) {
  if (!patterns.length) return "아직 축적된 성과 학습 규칙이 없습니다. 서로 뚜렷하게 다른 세 방향을 사용하세요.";
  return patterns
    .filter((pattern) => pattern.sampleSize >= 3)
    .slice(0, 8)
    .map((pattern) => `- ${pattern.hookStyle}: ${pattern.recommendation} (성과 ${pattern.score}, 표본 ${pattern.sampleSize})`)
    .join("\n");
}

async function generateDraft(
  openai: OpenAI,
  input: ShoppingShortsProductInput & { name: string; description: string; reviews: string[] },
  patterns: LearnedPattern[],
) {
  return withStructuredJsonRetry<RawGeneration>({
    label: "한국형 쇼핑 쇼츠 9개 기획",
    attempts: 2,
    request: async (attempt) => {
      const response = await openai.responses.create({
        model: modelName(),
        reasoning: { effort: attempt === 0 ? "high" : "medium" },
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: [
              "당신은 한국 소비자용 쇼핑 쇼츠의 전략가이자 팩트체커입니다.",
              `상품명: ${input.name}`,
              `확인된 설명: ${input.description}`,
              `상품 URL: ${input.url || "직접 입력"}`,
              `가격: ${input.priceText || "확인 필요"}`,
              `타깃 힌트: ${input.targetAudience || "상품 정보에서 도출"}`,
              `확인된 후기: ${input.reviews.length ? input.reviews.join(" / ") : "후기 데이터 없음"}`,
              "",
              "성과 학습 규칙:",
              learnedPrompt(patterns),
              "",
              "먼저 상품 특징과 후기 핵심, 한국 생활의 불편, 검증 가능한 판매 포인트를 분석하세요.",
              "서로 겹치지 않는 훅 3개를 만드세요: 문제해결형, 시각적 반전형, 비교·증거형.",
              "각 훅마다 15초·20초·30초 버전을 만들어 총 9개 variants를 반환하세요.",
              "variantKey는 H1-15, H1-20 ... H3-30 형식입니다.",
              "첫 장면은 0초에 시작하고 3초 전에 훅과 상품을 모두 보여주세요.",
              "장면은 시간 공백 없이 끝 시간이 정확히 해당 영상 길이가 되게 작성하세요.",
              "나레이션과 자막은 의미가 일치해야 하며 자막은 한 화면에서 빠르게 읽을 수 있게 짧게 쓰세요.",
              "자연스러운 대한민국 구어체를 사용하고 번역투, 과장, 최저가·1위·100% 같은 미검증 표현을 금지합니다.",
              "직접 써보지 않았다면 체험한 것처럼 말하지 마세요. 확인된 설명과 후기 밖의 수치·성능을 만들지 마세요.",
              "CTA는 설명란이나 프로필의 상품 링크 확인 방식으로 작성하세요.",
              "제목·설명·해시태그·세로형 썸네일 문구와 시각 지시까지 완성하세요.",
            ].join("\n"),
          }],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "gy_korean_shopping_shorts_generation",
            strict: true,
            schema: generationSchema,
          },
        },
        max_output_tokens: attempt === 0 ? 24000 : 30000,
      });
      return response.output_text;
    },
    validate: (value) => Boolean(value?.product && value.hooks?.length === 3 && value.variants?.length === 9 && validCombinations(value.variants)),
  });
}

async function auditDrafts(openai: OpenAI, variants: ShoppingShortsVariantDraft[]) {
  const payload = await withStructuredJsonRetry<{ audits: AuditItem[] }>({
    label: "쇼핑 쇼츠 8항목 품질 검수",
    attempts: 2,
    request: async () => {
      const response = await openai.responses.create({
        model: process.env.OPENAI_QUALITY_MODEL || modelName(),
        reasoning: { effort: "high" },
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: [
              "다음 한국형 쇼핑 쇼츠 기획안을 엄격히 심사하세요.",
              "각 안을 첫 3초 집중도, 장면 일관성, 상품 노출 명확성, 한국어 자연스러움, 자막 정확도, 구매 설득력, 과장 표현 안전성, 다른 안과의 중복 방지로 0~100점 평가하세요.",
              "claimSafety는 과장·허위 가능성이 낮을수록 높은 점수입니다. originality는 서로 다를수록 높은 점수입니다.",
              "문제가 있으면 구체적 문제와 바로 적용 가능한 수정지시를 한국어로 작성하세요.",
              JSON.stringify(variants),
            ].join("\n"),
          }],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "gy_shopping_shorts_quality_audit",
            strict: true,
            schema: auditSchema,
          },
        },
        max_output_tokens: 9000,
      });
      return response.output_text;
    },
    validate: (value) => Boolean(value?.audits?.length === variants.length),
  });
  return payload.audits;
}

async function reviseFailed(
  openai: OpenAI,
  failed: Array<{ variant: ShoppingShortsVariantDraft; audit: AuditItem; deterministicIssues: string[] }>,
) {
  const payload = await withStructuredJsonRetry<{ variants: ShoppingShortsVariantDraft[] }>({
    label: "기준 미달 쇼츠 자동 재생성",
    attempts: 2,
    request: async () => {
      const response = await openai.responses.create({
        model: modelName(),
        reasoning: { effort: "high" },
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: [
              "다음 쇼핑 쇼츠 중 품질 기준 미달인 안만 수정하세요.",
              "variantKey, hookIndex, duration은 절대 바꾸지 마세요.",
              "지적된 항목을 실제 대본·장면·자막·CTA에 반영하고, 확인되지 않은 주장은 추가하지 마세요.",
              "장면은 0초부터 해당 duration까지 공백 없이 이어져야 합니다.",
              JSON.stringify(failed),
            ].join("\n"),
          }],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "gy_shopping_shorts_revision",
            strict: true,
            schema: revisionSchema,
          },
        },
        max_output_tokens: 22000,
      });
      return response.output_text;
    },
    validate: (value) => Boolean(value?.variants?.length === failed.length),
  });
  const requested = new Set(failed.map((item) => item.variant.variantKey));
  if (!payload.variants.every((variant) => requested.has(variant.variantKey))) {
    throw new Error("자동 수정 결과의 변형 식별자가 일치하지 않습니다.");
  }
  return payload.variants.map(normalizeVariant);
}

function deterministicIssues(metrics: ShoppingShortsQualityMetrics) {
  const labels: Record<QualityMetricKey, string> = {
    firstThreeSeconds: "첫 3초 집중도",
    sceneConsistency: "장면 일관성",
    productClarity: "상품 노출 명확성",
    koreanNaturalness: "한국어 자연스러움",
    subtitleAccuracy: "자막 정확도",
    purchasePersuasion: "구매 설득력",
    claimSafety: "과장 표현 안전성",
    originality: "중복 방지",
  };
  return metricKeys.filter((key) => metrics[key] < 72).map((key) => `${labels[key]} ${metrics[key]}점`);
}

export async function generateShoppingShorts(input: {
  product: ShoppingShortsProductInput & { name: string; description: string; reviews: string[] };
  threshold: number;
  maxRegenerations: number;
  learnedPatterns?: LearnedPattern[];
  recentVariantTexts?: string[];
}): Promise<ShoppingShortsGeneration> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const threshold = Math.max(80, Math.min(95, Math.round(input.threshold || 86)));
  const maxRegenerations = Math.max(1, Math.min(2, Math.round(input.maxRegenerations || 2)));
  const initial = await generateDraft(openai, input.product, input.learnedPatterns || []);
  let drafts = initial.variants.map(normalizeVariant);
  const regenerationCounts = new Map(drafts.map((variant) => [variant.variantKey, 0]));
  let reports = new Map<string, ShoppingShortsVariant["quality"]>();

  for (let round = 0; round <= maxRegenerations; round += 1) {
    const audits = await auditDrafts(openai, drafts);
    const auditByKey = new Map(audits.map((audit) => [audit.variantKey, audit]));
    reports = new Map(drafts.map((variant) => {
      const comparisonTexts = [
        ...(input.recentVariantTexts || []),
        ...drafts.filter((item) => item.variantKey !== variant.variantKey).map((item) => `${item.hook} ${item.script}`),
      ];
      const deterministic = deterministicQuality(variant, comparisonTexts);
      const audit = auditByKey.get(variant.variantKey);
      const report = mergeQualityReport({
        deterministic,
        aiMetrics: normalizedMetrics(audit?.metrics),
        aiIssues: audit?.issues || [],
        aiInstructions: audit?.regenerationInstructions || [],
        threshold,
      });
      return [variant.variantKey, report];
    }));

    const failed = drafts.filter((variant) => !reports.get(variant.variantKey)?.approved);
    if (!failed.length || round === maxRegenerations) break;
    const failedPayload = failed.map((variant) => {
      const audit = auditByKey.get(variant.variantKey) || {
        variantKey: variant.variantKey,
        metrics: normalizedMetrics(undefined),
        issues: [],
        regenerationInstructions: [],
      };
      return {
        variant,
        audit,
        deterministicIssues: deterministicIssues(
          deterministicQuality(variant, drafts.filter((item) => item.variantKey !== variant.variantKey).map((item) => item.script)).metrics,
        ),
      };
    });
    const revisions = await reviseFailed(openai, failedPayload);
    const revisionByKey = new Map(revisions.map((variant) => [variant.variantKey, variant]));
    drafts = drafts.map((variant) => {
      const revised = revisionByKey.get(variant.variantKey);
      if (!revised) return variant;
      regenerationCounts.set(variant.variantKey, (regenerationCounts.get(variant.variantKey) || 0) + 1);
      return revised;
    });
  }

  const variants: ShoppingShortsVariant[] = drafts.map((variant) => ({
    ...variant,
    srt: scenesToSrt(variant.scenes),
    plainSubtitles: scenesToPlainSubtitles(variant.scenes),
    fingerprint: fingerprintVariant(variant),
    regenerationCount: regenerationCounts.get(variant.variantKey) || 0,
    quality: reports.get(variant.variantKey) || mergeQualityReport({
      deterministic: deterministicQuality(variant, []),
      aiMetrics: normalizedMetrics(undefined),
      aiIssues: ["품질 검수 결과가 누락되었습니다."],
      aiInstructions: ["다시 생성해주세요."],
      threshold,
    }),
  }));

  return {
    product: {
      summary: clean(initial.product.summary, 1000),
      keyFeatures: cleanArray(initial.product.keyFeatures, 12),
      reviewInsights: cleanArray(initial.product.reviewInsights, 12),
      painPoints: cleanArray(initial.product.painPoints, 12),
      targetAudience: clean(initial.product.targetAudience, 300),
      sellingPoints: cleanArray(initial.product.sellingPoints, 12),
      cautions: cleanArray(initial.product.cautions, 12),
    },
    hooks: initial.hooks
      .sort((a, b) => a.index - b.index)
      .slice(0, 3)
      .map((hook, index) => ({
        index: (index + 1) as 1 | 2 | 3,
        style: clean(hook.style, 80),
        text: clean(hook.text, 120),
        reason: clean(hook.reason, 300),
      })),
    variants,
    learnedPatternsUsed: (input.learnedPatterns || []).filter((pattern) => pattern.sampleSize >= 3).map((pattern) => pattern.patternKey),
    generatedAt: new Date().toISOString(),
  };
}

