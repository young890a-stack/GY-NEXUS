export type ProductPlatform =
  | "coupang"
  | "temu"
  | "naver-smartstore"
  | "11st"
  | "aliexpress"
  | "amazon"
  | "other";

export type ExtractionStatus = "complete" | "partial" | "manual";

export type ProductConfidence = {
  title: number;
  description: number;
  image: number;
  price: number;
};

export type ProductSource = {
  sourceUrl: string;
  resolvedUrl: string;
  platform: ProductPlatform;
  title: string;
  description: string;
  imageUrl: string;
  priceText: string;
  currency: string;
  extractionStatus: ExtractionStatus;
  extractionMethod?: "metadata" | "redirect-only" | "manual";
  blockedReason?: string;
  confidence?: ProductConfidence;
};

export type DNACampaignInput = ProductSource & {
  duration: 20 | 25 | 30;
  style: "million-view" | "cinematic" | "emotional" | "premium" | "ugc";
  targetAudience: string;
  productName?: string;
  productDescription?: string;
  manualImageUrl?: string;
  affiliateDisclosure?: string;
};

export type ProductDNA = {
  oneLineValue: string;
  targetPersona: string;
  coreBenefits: string[];
  proofPoints: string[];
  riskClaimsToAvoid: string[];
  visualIdentity: {
    mood: string;
    setting: string;
    camera: string;
    lighting: string;
    palette: string;
  };
  campaignConcept: string;
  imagePrompt: string;
  thumbnailHeadline: string;
  blogTitle: string;
  blogHtml: string;
  shortsTitle: string;
  shortsDescription: string;
  hashtags: string[];
  masterVideoPrompt: string;
};
