export type AffiliatePlatform = "coupang" | "temu";

export type AffiliateSourceMode =
  | "coupang-goldbox"
  | "coupang-category"
  | "coupang-search"
  | "temu-share-link";

export type AffiliateCandidate = {
  platform: AffiliatePlatform;
  sourceMode: AffiliateSourceMode;
  externalId: string;
  title: string;
  description: string;
  imageUrl: string;
  affiliateUrl: string;
  resolvedUrl?: string;
  priceText: string;
  category: string;
  rank: number;
  dataQualityScore: number;
  linkStatus: "verified" | "provider-link" | "unconfirmed";
  rawData: Record<string, unknown>;
};

export type AffiliateLinkCheck = {
  valid: boolean;
  platform: AffiliatePlatform | "unknown";
  normalizedUrl: string;
  host: string;
  linkStatus: "verified" | "provider-link" | "unconfirmed" | "invalid";
  evidence: string[];
  warning?: string;
};

export type CoupangDiscoveryMode = "goldbox" | "category" | "search";
