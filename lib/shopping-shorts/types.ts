export type ShoppingShortsDuration = 15 | 20 | 30;

export type ShoppingShortsProductInput = {
  url?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  priceText?: string;
  reviews?: string[];
  targetAudience?: string;
  supplyPrice?: number;
  shippingCost?: number;
  platformFeeRate?: number;
  adCostPerOrder?: number;
  returnReserveRate?: number;
  sellingPrice?: number;
};

export type ProductInsight = {
  summary: string;
  keyFeatures: string[];
  reviewInsights: string[];
  painPoints: string[];
  targetAudience: string;
  sellingPoints: string[];
  cautions: string[];
};

export type ShoppingShortsScene = {
  start: number;
  end: number;
  visual: string;
  narration: string;
  subtitle: string;
  productVisible: boolean;
};

export type ShoppingShortsThumbnail = {
  headline: string;
  subline: string;
  badge: string;
  visualDirection: string;
};

export type ShoppingShortsVariantDraft = {
  variantKey: string;
  hookIndex: 1 | 2 | 3;
  hookStyle: string;
  duration: ShoppingShortsDuration;
  hook: string;
  title: string;
  description: string;
  hashtags: string[];
  script: string;
  cta: string;
  thumbnail: ShoppingShortsThumbnail;
  scenes: ShoppingShortsScene[];
};

export type QualityMetricKey =
  | "firstThreeSeconds"
  | "sceneConsistency"
  | "productClarity"
  | "koreanNaturalness"
  | "subtitleAccuracy"
  | "purchasePersuasion"
  | "claimSafety"
  | "originality";

export type ShoppingShortsQualityMetrics = Record<QualityMetricKey, number>;

export type ShoppingShortsQualityReport = {
  approved: boolean;
  score: number;
  threshold: number;
  metrics: ShoppingShortsQualityMetrics;
  issues: string[];
  regenerationInstructions: string[];
  deterministicScore: number;
  aiScore: number;
  evaluatedAt: string;
};

export type ShoppingShortsVariant = ShoppingShortsVariantDraft & {
  srt: string;
  plainSubtitles: string;
  fingerprint: string;
  regenerationCount: number;
  quality: ShoppingShortsQualityReport;
};

export type ShoppingShortsGeneration = {
  product: ProductInsight;
  hooks: Array<{ index: 1 | 2 | 3; style: string; text: string; reason: string }>;
  variants: ShoppingShortsVariant[];
  learnedPatternsUsed: string[];
  generatedAt: string;
};

export type LearnedPattern = {
  patternKey: string;
  hookStyle: string;
  recommendation: string;
  score: number;
  sampleSize: number;
};

