import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalizeUrl, candidateDedupeHash, scoreCandidate } from "@/lib/shorts-intelligence-v3/scoring";
import type { CandidateInput } from "@/lib/shorts-intelligence-v3/types";

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { runId?: unknown; candidates?: unknown };
    const runId = String(body.runId || "").trim();
    const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 300) as CandidateInput[] : [];
    if (!runId || !candidates.length) {
      return NextResponse.json({ success: false, message: "runId와 후보 영상 목록이 필요합니다." }, { status: 400 });
    }
    const normalized = candidates.flatMap((candidate) => {
      try {
        if (!candidate || !["douyin", "xiaohongshu"].includes(candidate.platform)) return [];
        const canonicalUrl = canonicalizeUrl(String(candidate.url || ""));
        const scores = scoreCandidate(candidate);
        return [{
          run_id: runId,
          platform: candidate.platform,
          external_id: candidate.externalId || null,
          url: String(candidate.url),
          canonical_url: canonicalUrl,
          title: String(candidate.title || "").slice(0, 300),
          author: candidate.author || null,
          posted_at: candidate.postedAt || null,
          duration_seconds: safeNumber(candidate.durationSeconds),
          thumbnail_url: candidate.thumbnailUrl || null,
          views: safeNumber(candidate.views),
          likes: safeNumber(candidate.likes),
          comments: safeNumber(candidate.comments),
          saves: safeNumber(candidate.saves),
          shares: safeNumber(candidate.shares),
          search_rank: safeNumber(candidate.searchRank),
          repeated_exposure_count: Math.max(1, Math.round(Number(candidate.repeatedExposureCount) || 1)),
          keyword_hits: Array.isArray(candidate.keywordHits) ? candidate.keywordHits.slice(0, 20) : [],
          cross_platform_match: Boolean(candidate.crossPlatformMatch),
          trend_velocity: safeNumber(candidate.trendVelocity) || 0,
          engagement_rate: scores.engagementRate,
          popularity_score: scores.popularityScore,
          relevance_score: scores.relevanceScore,
          visual_sellability_score: scores.visualSellabilityScore,
          total_intelligence_score: scores.totalIntelligenceScore,
          source_mode: candidate.sourceMode || "account-assisted",
          rights_status: "unverified",
          can_use_original: false,
          dedupe_hash: candidateDedupeHash(candidate),
          raw_data: candidate.rawData || {},
        }];
      } catch {
        return [];
      }
    });
    if (!normalized.length) {
      return NextResponse.json({ success: false, message: "유효한 도우인·샤오홍슈 후보가 없습니다." }, { status: 400 });
    }
    const deduped = Array.from(new Map(normalized.map((item) => [item.canonical_url, item])).values());
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("china_video_candidates")
      .upsert(deduped, { onConflict: "run_id,canonical_url" })
      .select("id,total_intelligence_score");
    if (error) throw error;
    const { count } = await supabase.from("china_video_candidates").select("id", { count: "exact", head: true }).eq("run_id", runId);
    await supabase.from("china_discovery_runs").update({
      collected_candidate_count: count || 0,
      status: (count || 0) >= 20 ? "analyzing" : "collecting",
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
    return NextResponse.json({ success: true, inserted: data?.length ?? 0, total: count || 0 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "후보 영상을 저장하지 못했습니다." }, { status: 500 });
  }
}
