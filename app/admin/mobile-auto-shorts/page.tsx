import MobileAutoShorts from "@/components/mobile-auto-shorts/MobileAutoShorts";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "모바일 자동 쇼츠 승인실 · GY-NEXUS",
  description: "상품 선택 또는 제휴링크 입력 한 번으로 창작부터 비공개 배포 대기열까지 진행하는 모바일 자동화 화면",
};

type RawOpportunity = {
  commissionPotential?: number;
  visualDemo?: number;
  demand?: number;
  competition?: number;
  dataConfidence?: number;
};

type TrendRow = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  affiliate_url?: string | null;
  platform?: string | null;
  price_text?: string | null;
  ai_score?: number | null;
  opportunity_grade?: string | null;
  data_quality_score?: number | null;
  external_rank?: number | null;
  status?: string | null;
  raw_data?: { opportunity?: RawOpportunity } | null;
};

type ProductRow = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  affiliate_url?: string | null;
  platform?: string | null;
  price_text?: string | null;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function rankScore(rank?: number | null) {
  if (!rank || rank < 1) return 55;
  return clamp(100 - (rank - 1) * 3);
}

function opportunityScore(row: TrendRow) {
  const opportunity = row.raw_data?.opportunity || {};
  const demand = clamp(Number(opportunity.demand ?? row.ai_score ?? 55));
  const commission = clamp(Number(opportunity.commissionPotential ?? 55));
  const visual = clamp(Number(opportunity.visualDemo ?? (row.image_url ? 80 : 40)));
  const confidence = clamp(Number(opportunity.dataConfidence ?? row.data_quality_score ?? 50));
  const competition = clamp(Number(opportunity.competition ?? 55));
  const competitionAdvantage = 100 - competition;
  const score = demand * 0.35
    + commission * 0.25
    + visual * 0.16
    + confidence * 0.14
    + rankScore(row.external_rank) * 0.06
    + competitionAdvantage * 0.04;
  return Math.round(clamp(score));
}

function validHttp(value?: string | null) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export default async function MobileAutoShortsPage() {
  const supabase = createAdminClient();
  const [trendResult, productResult] = await Promise.all([
    supabase
      .from("trend_products")
      .select("id,title,description,image_url,affiliate_url,platform,price_text,ai_score,opportunity_grade,data_quality_score,external_rank,status,raw_data")
      .in("status", ["approved", "analyzed"])
      .not("affiliate_url", "is", null)
      .not("image_url", "is", null)
      .order("ai_score", { ascending: false })
      .limit(80),
    supabase
      .from("products")
      .select("id,title,description,image_url,affiliate_url,platform,price_text")
      .not("affiliate_url", "is", null)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const trendCandidates = ((trendResult.data || []) as TrendRow[]).map((row) => ({
    id: `trend-${row.id}`,
    title: row.title,
    description: row.description || "",
    imageUrl: row.image_url || "",
    affiliateUrl: row.affiliate_url || "",
    platform: row.platform || "etc",
    priceText: row.price_text || "가격 확인 필요",
    aiScore: Math.round(Number(row.ai_score) || 0),
    profitOpportunityScore: opportunityScore(row),
    opportunityGrade: row.opportunity_grade || "-",
    dataQualityScore: Math.round(Number(row.data_quality_score) || 0),
    externalRank: Number(row.external_rank) || null,
  }));

  const savedCandidates = ((productResult.data || []) as ProductRow[]).map((row) => ({
    id: `product-${row.id}`,
    title: row.title,
    description: row.description || "",
    imageUrl: row.image_url || "",
    affiliateUrl: row.affiliate_url || "",
    platform: row.platform || "etc",
    priceText: row.price_text || "가격 확인 필요",
    aiScore: 65,
    profitOpportunityScore: 62,
    opportunityGrade: "B",
    dataQualityScore: row.description && row.image_url ? 75 : 55,
    externalRank: null,
  }));

  const byAffiliate = new Map<string, (typeof trendCandidates)[number]>();
  for (const item of [...trendCandidates, ...savedCandidates]) {
    if (!item.title || !validHttp(item.imageUrl) || !validHttp(item.affiliateUrl)) continue;
    const previous = byAffiliate.get(item.affiliateUrl);
    if (!previous || item.profitOpportunityScore > previous.profitOpportunityScore) {
      byAffiliate.set(item.affiliateUrl, item);
    }
  }

  const candidates = Array.from(byAffiliate.values())
    .sort((a, b) => b.profitOpportunityScore - a.profitOpportunityScore || b.aiScore - a.aiScore)
    .slice(0, 18);

  const errors = [trendResult.error?.message, productResult.error?.message].filter(Boolean).join(" · ");
  return <MobileAutoShorts candidates={candidates} loadError={errors} />;
}
