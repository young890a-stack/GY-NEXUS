import type { CandidateInput, ProfitEstimate, ProfitEstimateInput } from "./types";

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function nonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function canonicalizeUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  ["utm_source", "utm_medium", "utm_campaign", "share_token", "share_id", "source"].forEach((key) => url.searchParams.delete(key));
  url.hostname = url.hostname.toLowerCase();
  const normalized = url.toString();
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

export function candidateDedupeHash(candidate: CandidateInput) {
  const stable = [
    candidate.platform,
    candidate.externalId || "",
    canonicalizeUrl(candidate.url),
    String(candidate.title || "").toLowerCase().replace(/\s+/g, " ").trim(),
    String(candidate.author || "").toLowerCase().trim(),
  ].join("|");
  let hash = 2166136261;
  for (let index = 0; index < stable.length; index += 1) {
    hash ^= stable.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function scoreCandidate(candidate: CandidateInput) {
  const views = nonNegative(candidate.views);
  const likes = nonNegative(candidate.likes);
  const comments = nonNegative(candidate.comments);
  const saves = nonNegative(candidate.saves);
  const shares = nonNegative(candidate.shares);
  const base = views > 0 ? views : Math.max(1, likes * 12 + comments * 35 + saves * 30 + shares * 40);
  const engagementRate = clamp(((likes + comments * 2 + saves * 2.5 + shares * 3) / base) * 100, 0, 100);
  const velocity = clamp(nonNegative(candidate.trendVelocity), 0, 100);
  const repeat = clamp((nonNegative(candidate.repeatedExposureCount) - 1) * 12, 0, 100);
  const cross = candidate.crossPlatformMatch ? 100 : 0;
  const searchRankScore = candidate.searchRank ? clamp(105 - candidate.searchRank * 5) : 45;
  const metricDepth = [views, likes, comments, saves, shares].filter((value) => value > 0).length;
  const evidenceScore = clamp(metricDepth * 18 + (candidate.postedAt ? 10 : 0));
  const popularityScore = Math.round(clamp(
    velocity * 0.25
      + engagementRate * 0.2
      + repeat * 0.15
      + cross * 0.1
      + searchRankScore * 0.15
      + evidenceScore * 0.15,
  ));
  const relevanceScore = Math.round(clamp(Number(candidate.relevanceScore ?? 60)));
  const visualSellabilityScore = Math.round(clamp(Number(candidate.visualSellabilityScore ?? 60)));
  const totalIntelligenceScore = Math.round(clamp(
    popularityScore * 0.45 + relevanceScore * 0.3 + visualSellabilityScore * 0.25,
  ));
  return { engagementRate, popularityScore, relevanceScore, visualSellabilityScore, totalIntelligenceScore };
}

export function estimateProfit(input: ProfitEstimateInput): ProfitEstimate {
  const commissionRate = clamp(input.commissionRate, 0, 100);
  const conversionRate = clamp(input.expectedConversionRate, 0, 100);
  const returnRate = clamp(input.expectedReturnRate, 0, 100);
  const averageOrderValue = nonNegative(input.averageOrderValue);
  const expectedClicks = Math.max(0, Math.round(nonNegative(input.expectedClicks)));
  const expectedOrders = expectedClicks * (conversionRate / 100);
  const expectedGrossCommission = expectedOrders * averageOrderValue * (commissionRate / 100);
  const expectedRefundLoss = expectedGrossCommission * (returnRate / 100);
  const expectedNetProfit = expectedGrossCommission
    - expectedRefundLoss
    - nonNegative(input.estimatedContentCost)
    - nonNegative(input.estimatedAdCost);
  const highCommissionEligible = Boolean(input.commissionVerified && commissionRate >= 30);
  const marginEvidenceScore = input.commissionVerified ? 100 : 0;
  const netProfitScore = clamp(expectedNetProfit <= 0 ? 0 : Math.log10(expectedNetProfit + 1) * 28);
  const conversionScore = clamp(conversionRate * 16);
  const commissionScore = clamp(commissionRate * 2.5);
  const riskScore = Math.round(clamp(returnRate * 4 + (input.commissionVerified ? 0 : 40)));
  const profitScore = Math.round(clamp(
    commissionScore * 0.35
      + conversionScore * 0.2
      + netProfitScore * 0.3
      + marginEvidenceScore * 0.15
      - riskScore * 0.25,
  ));
  return {
    expectedOrders: Number(expectedOrders.toFixed(4)),
    expectedGrossCommission: Number(expectedGrossCommission.toFixed(2)),
    expectedRefundLoss: Number(expectedRefundLoss.toFixed(2)),
    expectedNetProfit: Number(expectedNetProfit.toFixed(2)),
    highCommissionEligible,
    profitScore,
    riskScore,
  };
}
