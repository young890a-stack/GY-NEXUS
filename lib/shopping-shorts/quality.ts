import { createHash } from "node:crypto";
import type {
  QualityMetricKey,
  ShoppingShortsQualityMetrics,
  ShoppingShortsQualityReport,
  ShoppingShortsVariantDraft,
} from "./types";

const METRIC_WEIGHTS: Record<QualityMetricKey, number> = {
  firstThreeSeconds: 0.18,
  sceneConsistency: 0.13,
  productClarity: 0.14,
  koreanNaturalness: 0.13,
  subtitleAccuracy: 0.12,
  purchasePersuasion: 0.12,
  claimSafety: 0.1,
  originality: 0.08,
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const compact = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const koreanCharacters = (value: string) => (value.match(/[가-힣]/g) || []).length;
const unsafeClaims = /(무조건|100\s*%|완벽(?:히|한)?|절대|기적|즉시\s*(?:치료|완치)|최저가|1위|유일)/g;

function tokenSet(value: string) {
  return new Set(value.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []);
}

function similarity(left: string, right: string) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) intersection += 1;
  });
  return intersection / (a.size + b.size - intersection);
}

function scoreFirstThreeSeconds(variant: ShoppingShortsVariantDraft) {
  const firstScenes = variant.scenes.filter((scene) => scene.start < 3);
  const firstText = firstScenes.map((scene) => `${scene.narration} ${scene.subtitle}`).join(" ");
  let score = 55;
  const hookLength = compact(variant.hook).length;
  if (hookLength >= 8 && hookLength <= 34) score += 18;
  if (firstScenes[0]?.start === 0 && firstScenes.some((scene) => scene.end >= 2.2)) score += 12;
  if (similarity(firstText, variant.hook) >= 0.2) score += 10;
  if (/[?!]|왜|아직|매번|불편|문제|결과|이렇게/.test(variant.hook)) score += 5;
  return clamp(score);
}

function scoreSceneConsistency(variant: ShoppingShortsVariantDraft) {
  if (!variant.scenes.length) return 0;
  let penalty = 0;
  let cursor = 0;
  variant.scenes.forEach((scene) => {
    if (Math.abs(scene.start - cursor) > 0.15) penalty += 12;
    if (scene.end <= scene.start) penalty += 30;
    if (!scene.visual.trim() || !scene.narration.trim() || !scene.subtitle.trim()) penalty += 12;
    cursor = scene.end;
  });
  if (Math.abs(cursor - variant.duration) > 0.2) penalty += 20;
  return clamp(100 - penalty);
}

function scoreProductClarity(variant: ShoppingShortsVariantDraft) {
  const visible = variant.scenes.filter((scene) => scene.productVisible).length;
  const ratio = variant.scenes.length ? visible / variant.scenes.length : 0;
  const firstVisible = variant.scenes.some((scene) => scene.start < 3 && scene.productVisible);
  return clamp(45 + ratio * 40 + (firstVisible ? 15 : 0));
}

function scoreKoreanNaturalness(variant: ShoppingShortsVariantDraft) {
  const text = `${variant.hook} ${variant.script} ${variant.scenes.map((scene) => scene.subtitle).join(" ")}`;
  const letters = (text.match(/\p{L}/gu) || []).length;
  const koreanRatio = letters ? koreanCharacters(text) / letters : 0;
  let score = 55 + Math.min(35, koreanRatio * 45);
  if (/[?]{2,}|�|(?:합니다){3,}/.test(text)) score -= 25;
  if (variant.scenes.some((scene) => compact(scene.subtitle).length > 34)) score -= 10;
  return clamp(score);
}

function scoreSubtitleAccuracy(variant: ShoppingShortsVariantDraft) {
  if (!variant.scenes.length) return 0;
  const similarities = variant.scenes.map((scene) => similarity(scene.narration, scene.subtitle));
  const average = similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
  const readable = variant.scenes.filter((scene) => compact(scene.subtitle).length >= 2 && compact(scene.subtitle).length <= 34).length / variant.scenes.length;
  return clamp(35 + average * 40 + readable * 25);
}

function scorePurchasePersuasion(variant: ShoppingShortsVariantDraft) {
  const text = `${variant.hook} ${variant.script} ${variant.cta}`;
  let score = 55;
  if (/(불편|문제|고민|번거)/.test(text)) score += 10;
  if (/(해결|간편|줄이|도와|활용|확인)/.test(text)) score += 15;
  if (variant.cta.trim().length >= 5) score += 10;
  if (/(링크|상품|설명|프로필|확인)/.test(variant.cta)) score += 10;
  return clamp(score);
}

function scoreClaimSafety(variant: ShoppingShortsVariantDraft) {
  const matches = `${variant.hook} ${variant.script} ${variant.description}`.match(unsafeClaims) || [];
  return clamp(100 - matches.length * 22);
}

function scoreOriginality(variant: ShoppingShortsVariantDraft, comparisonTexts: string[]) {
  const text = `${variant.hook} ${variant.script}`;
  const maximum = comparisonTexts.reduce((max, comparison) => Math.max(max, similarity(text, comparison)), 0);
  return clamp(100 - maximum * 70);
}

export function weightedQualityScore(metrics: ShoppingShortsQualityMetrics) {
  return clamp(
    (Object.keys(METRIC_WEIGHTS) as QualityMetricKey[])
      .reduce((sum, key) => sum + metrics[key] * METRIC_WEIGHTS[key], 0),
  );
}

export function fingerprintVariant(variant: ShoppingShortsVariantDraft) {
  return createHash("sha256").update(compact(`${variant.hook}|${variant.script}`)).digest("hex").slice(0, 24);
}

export function deterministicQuality(
  variant: ShoppingShortsVariantDraft,
  comparisonTexts: string[],
) {
  const metrics: ShoppingShortsQualityMetrics = {
    firstThreeSeconds: scoreFirstThreeSeconds(variant),
    sceneConsistency: scoreSceneConsistency(variant),
    productClarity: scoreProductClarity(variant),
    koreanNaturalness: scoreKoreanNaturalness(variant),
    subtitleAccuracy: scoreSubtitleAccuracy(variant),
    purchasePersuasion: scorePurchasePersuasion(variant),
    claimSafety: scoreClaimSafety(variant),
    originality: scoreOriginality(variant, comparisonTexts),
  };
  return { metrics, score: weightedQualityScore(metrics) };
}

export function mergeQualityReport(input: {
  deterministic: ReturnType<typeof deterministicQuality>;
  aiMetrics: ShoppingShortsQualityMetrics;
  aiIssues: string[];
  aiInstructions: string[];
  threshold: number;
}): ShoppingShortsQualityReport {
  const metrics = Object.fromEntries(
    (Object.keys(METRIC_WEIGHTS) as QualityMetricKey[]).map((key) => [
      key,
      clamp(input.deterministic.metrics[key] * 0.55 + input.aiMetrics[key] * 0.45),
    ]),
  ) as ShoppingShortsQualityMetrics;
  const score = weightedQualityScore(metrics);
  const hardGatePassed = (Object.keys(metrics) as QualityMetricKey[]).every((key) => metrics[key] >= 72);
  return {
    approved: score >= input.threshold && hardGatePassed,
    score,
    threshold: input.threshold,
    metrics,
    issues: Array.from(new Set(input.aiIssues.map((item) => item.trim()).filter(Boolean))).slice(0, 10),
    regenerationInstructions: Array.from(new Set(input.aiInstructions.map((item) => item.trim()).filter(Boolean))).slice(0, 10),
    deterministicScore: input.deterministic.score,
    aiScore: weightedQualityScore(input.aiMetrics),
    evaluatedAt: new Date().toISOString(),
  };
}

