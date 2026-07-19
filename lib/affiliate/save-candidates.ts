import { createAdminClient } from "@/lib/supabase/admin";
import { calculateOpportunity } from "@/lib/product-intelligence/opportunity";
import type { AffiliateCandidate, AffiliatePlatform, AffiliateSourceMode } from "./types";

function demandScore(candidate: AffiliateCandidate) {
  const rankScore = Math.max(45, 98 - Math.max(0, candidate.rank - 1) * 2);
  if (candidate.sourceMode === "coupang-goldbox") return Math.min(98, rankScore + 4);
  if (candidate.sourceMode === "coupang-category") return rankScore;
  if (candidate.sourceMode === "coupang-search") return Math.min(82, rankScore);
  return Math.min(75, rankScore);
}

export function candidateToTrendRow(candidate: AffiliateCandidate, sourceName: string, collectedAt: string) {
  const opportunity = calculateOpportunity({
    demand: demandScore(candidate),
    seasonality: candidate.sourceMode === "coupang-goldbox" ? 78 : 58,
    priceAppeal: candidate.priceText ? 72 : 50,
    visualDemo: candidate.imageUrl ? 84 : 48,
    audienceFit: /가전|디지털|생활|주방|인테리어|노트북|태블릿|청소/i.test(`${candidate.category} ${candidate.title}`) ? 88 : 68,
    commissionPotential: 55,
    competition: candidate.rank <= 10 ? 66 : 55,
    policyRisk: /의약|치료|효능|다이어트/i.test(`${candidate.category} ${candidate.title}`) ? 60 : 15,
    dataConfidence: candidate.dataQualityScore,
  });
  const keyword = candidate.category || candidate.title;
  return {
    title: candidate.title,
    description: candidate.description,
    image_url: candidate.imageUrl || null,
    affiliate_url: candidate.affiliateUrl,
    platform: candidate.platform,
    price_text: candidate.priceText,
    source_name: sourceName,
    external_id: candidate.externalId || null,
    external_rank: candidate.rank,
    external_score: demandScore(candidate),
    trend_score: opportunity.score,
    status: "analyzed",
    ai_score: opportunity.score,
    opportunity_grade: opportunity.grade,
    opportunity_recommendation: opportunity.recommendation,
    ai_summary: `${opportunity.grade}등급 · ${opportunity.recommendation}. ${opportunity.reasons.join(" ")}`,
    target_audience: "20~40대 실용 소비자",
    selling_points: opportunity.reasons,
    seo_keywords: [keyword, `${keyword} 추천`, `${keyword} 사용법`].filter(Boolean),
    shorts_hook: opportunity.visualDemo >= 70 ? "3초 안에 쓰임새가 보이는 장면으로 시작하세요." : "이 제품이 지금 주목받는 이유를 확인해보세요.",
    caution: opportunity.risks.join(" "),
    analyzed_at: collectedAt,
    collected_at: collectedAt,
    last_seen_at: collectedAt,
    link_checked_at: collectedAt,
    link_status: candidate.linkStatus,
    source_verified: candidate.linkStatus === "verified",
    data_quality_score: candidate.dataQualityScore,
    provider_mode: candidate.sourceMode,
    raw_data: {
      sourceMode: candidate.sourceMode,
      category: candidate.category || null,
      resolvedUrl: candidate.resolvedUrl || null,
      opportunity,
      provider: candidate.rawData,
    },
  };
}

export async function saveAffiliateCandidates(input: {
  provider: AffiliatePlatform;
  mode: AffiliateSourceMode;
  sourceName: string;
  items: AffiliateCandidate[];
  requestedCount: number;
  rejected?: Array<{ input: string; reason: string }>;
}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const rows = input.items.map((item) => candidateToTrendRow(item, input.sourceName, now));
  const selectFields = "id,title,platform,affiliate_url,ai_score,opportunity_grade,link_status,data_quality_score";
  const externalIds = [...new Set(rows.map((row) => row.external_id).filter((value): value is string => Boolean(value)))];
  const existingByExternalId = new Map<string, { id: string; status: string }>();

  if (externalIds.length) {
    const { data: existing, error: existingError } = await supabase
      .from("trend_products")
      .select("id,external_id,status")
      .eq("platform", input.provider)
      .in("external_id", externalIds);
    if (existingError) {
      if (/external_id/i.test(existingError.message)) {
        throw new Error("제휴 상품 연동 DB 보완이 아직 적용되지 않았습니다. AFFILIATE-PRODUCT-SOURCING-MIGRATION.sql을 먼저 실행해주세요.");
      }
      throw existingError;
    }
    (existing || []).forEach((item) => {
      if (item.external_id) existingByExternalId.set(item.external_id, { id: item.id, status: item.status });
    });
  }

  const updates = rows.filter((row) => row.external_id && existingByExternalId.has(row.external_id));
  const inserts = rows.filter((row) => !row.external_id || !existingByExternalId.has(row.external_id));
  const updated = await Promise.all(updates.map(async (row) => {
    const existing = existingByExternalId.get(row.external_id as string)!;
    const { source_name: _sourceName, ...values } = row;
    void _sourceName;
    const { data, error } = await supabase
      .from("trend_products")
      .update({ ...values, status: existing.status === "approved" ? "approved" : "analyzed" })
      .eq("id", existing.id)
      .select(selectFields)
      .single();
    if (error) throw error;
    return data;
  }));

  let inserted: Array<Record<string, unknown>> = [];
  let insertError: { message: string } | null = null;
  if (inserts.length) {
    const result = await supabase
      .from("trend_products")
      .upsert(inserts, { onConflict: "source_name,affiliate_url" })
      .select(selectFields);
    inserted = (result.data || []) as Array<Record<string, unknown>>;
    insertError = result.error;
  }
  if (insertError) {
    if (/external_id|last_seen_at|link_status|source_verified|data_quality_score|provider_mode/i.test(insertError.message)) {
      throw new Error("제휴 상품 연동 DB 보완이 아직 적용되지 않았습니다. AFFILIATE-PRODUCT-SOURCING-MIGRATION.sql을 먼저 실행해주세요.");
    }
    throw new Error(insertError.message);
  }
  const data = [...updated, ...inserted];

  const rejected = input.rejected || [];
  await supabase.from("affiliate_sync_runs").insert({
    provider: input.provider,
    mode: input.mode,
    source_name: input.sourceName,
    status: rejected.length ? "partial" : "completed",
    requested_count: input.requestedCount,
    accepted_count: data.length,
    rejected_count: rejected.length,
    details: { rejected },
    finished_at: now,
  });
  return data;
}

export async function recordAffiliateSyncFailure(input: {
  provider: AffiliatePlatform;
  mode: AffiliateSourceMode;
  sourceName: string;
  requestedCount: number;
  message: string;
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from("affiliate_sync_runs").insert({
      provider: input.provider,
      mode: input.mode,
      source_name: input.sourceName,
      status: "failed",
      requested_count: input.requestedCount,
      accepted_count: 0,
      rejected_count: input.requestedCount,
      error_summary: input.message.slice(0, 1000),
      finished_at: new Date().toISOString(),
    });
  } catch {
    // 원래 오류를 가리지 않도록 감사 로그 실패는 조용히 종료합니다.
  }
}
