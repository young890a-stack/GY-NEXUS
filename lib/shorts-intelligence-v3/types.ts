export type ChinaPlatform = "douyin" | "xiaohongshu";
export type VariantKey = "A" | "B" | "C";
export type VariantType = "problem-solution" | "visual-surprise" | "comparison-proof";

export type CandidateInput = {
  platform: ChinaPlatform;
  externalId?: string | null;
  url: string;
  title?: string | null;
  author?: string | null;
  postedAt?: string | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  saves?: number | null;
  shares?: number | null;
  searchRank?: number | null;
  repeatedExposureCount?: number | null;
  keywordHits?: string[];
  crossPlatformMatch?: boolean;
  trendVelocity?: number | null;
  relevanceScore?: number | null;
  visualSellabilityScore?: number | null;
  sourceMode?: "account-assisted" | "official-api" | "public-index";
  rawData?: Record<string, unknown>;
};

export type ProfitEstimateInput = {
  productId?: string | null;
  discoveryRunId?: string | null;
  affiliatePlatform: string;
  campaignName?: string | null;
  commissionRate: number;
  commissionVerified: boolean;
  commissionSource?: string | null;
  averageOrderValue: number;
  expectedClicks: number;
  expectedConversionRate: number;
  expectedReturnRate: number;
  estimatedContentCost: number;
  estimatedAdCost: number;
};

export type ProfitEstimate = {
  expectedOrders: number;
  expectedGrossCommission: number;
  expectedRefundLoss: number;
  expectedNetProfit: number;
  highCommissionEligible: boolean;
  profitScore: number;
  riskScore: number;
};
