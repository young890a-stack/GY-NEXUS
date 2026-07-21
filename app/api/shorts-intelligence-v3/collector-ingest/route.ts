import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalizeUrl, candidateDedupeHash, scoreCandidate } from "@/lib/shorts-intelligence-v3/scoring";
import type { CandidateInput } from "@/lib/shorts-intelligence-v3/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-GY-Collector-Token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("x-gy-collector-token")?.trim() || "";
    if (!token.startsWith("gyc_") || token.length < 30) {
      return NextResponse.json({ success: false, message: "유효한 수집 토큰이 필요합니다." }, { status: 401, headers: corsHeaders });
    }
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase.from("china_collector_sessions_v3")
      .select("id,run_id,status,target_candidate_count,collected_candidate_count,expires_at")
      .eq("token_hash", tokenHash(token)).eq("status", "active").single();
    if (sessionError || !session || new Date(session.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ success: false, message: "수집 토큰이 만료되었거나 취소되었습니다." }, { status: 401, headers: corsHeaders });
    }
    const body = await request.json() as { platform?: unknown; keyword?: unknown; candidates?: unknown };
    const platform = String(body.platform || "");
    if (platform !== "douyin" && platform !== "xiaohongshu") {
      return NextResponse.json({ success: false, message: "지원하지 않는 플랫폼입니다." }, { status: 400, headers: corsHeaders });
    }
    const keyword = String(body.keyword || "").replace(/\s+/g, " ").trim().slice(0, 80);
    const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 50) as CandidateInput[] : [];
    const normalized = candidates.flatMap((candidate) => {
      try {
        if (!candidate || candidate.platform !== platform) return [];
        const canonicalUrl = canonicalizeUrl(String(candidate.url || ""));
        const scores = scoreCandidate(candidate);
        return [{
          run_id: session.run_id,
          platform,
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
          keyword_hits: Array.from(new Set([keyword, ...(Array.isArray(candidate.keywordHits) ? candidate.keywordHits : [])].filter(Boolean))).slice(0, 20),
          cross_platform_match: Boolean(candidate.crossPlatformMatch),
          trend_velocity: safeNumber(candidate.trendVelocity) || 0,
          engagement_rate: scores.engagementRate,
          popularity_score: scores.popularityScore,
          relevance_score: scores.relevanceScore,
          visual_sellability_score: scores.visualSellabilityScore,
          total_intelligence_score: scores.totalIntelligenceScore,
          source_mode: "account-assisted",
          rights_status: "unverified",
          can_use_original: false,
          dedupe_hash: candidateDedupeHash(candidate),
          raw_data: candidate.rawData || {},
          gemini_status: "pending",
        }];
      } catch {
        return [];
      }
    });
    if (normalized.length) {
      const deduped = Array.from(new Map(normalized.map((item) => [item.canonical_url, item])).values());
      const urls = deduped.map((item) => item.canonical_url);
      const { data: existingRows, error: existingError } = await supabase.from("china_video_candidates")
        .select("canonical_url,keyword_hits,repeated_exposure_count,raw_data")
        .eq("run_id", session.run_id).in("canonical_url", urls);
      if (existingError) throw existingError;
      const existingByUrl = new Map((existingRows ?? []).map((item) => [String(item.canonical_url), item]));
      const merged = deduped.map((item) => {
        const existing = existingByUrl.get(item.canonical_url);
        const existingKeywords = Array.isArray(existing?.keyword_hits) ? existing.keyword_hits.map(String) : [];
        const existingRaw = existing?.raw_data && typeof existing.raw_data === "object" ? existing.raw_data as Record<string, unknown> : {};
        return {
          ...item,
          keyword_hits: Array.from(new Set([...existingKeywords, ...item.keyword_hits.map(String)])).slice(0, 20),
          repeated_exposure_count: Math.max(Number(existing?.repeated_exposure_count || 0) + 1, item.repeated_exposure_count),
          raw_data: { ...existingRaw, ...item.raw_data },
        };
      });
      const { error } = await supabase.from("china_video_candidates")
        .upsert(merged, { onConflict: "run_id,canonical_url" });
      if (error) throw error;
    }
    const { count } = await supabase.from("china_video_candidates")
      .select("id", { count: "exact", head: true }).eq("run_id", session.run_id);
    const total = count || 0;
    const complete = total >= session.target_candidate_count;
    await supabase.from("china_collector_sessions_v3").update({
      collected_candidate_count: total,
      last_platform: platform,
      last_keyword: keyword || null,
      last_seen_at: now,
      updated_at: now,
      status: complete ? "completed" : "active",
    }).eq("id", session.id);
    await supabase.from("china_discovery_runs").update({
      collected_candidate_count: total,
      collector_status: complete ? "completed" : "collecting",
      collector_last_seen_at: now,
      status: complete ? "analyzing" : "collecting",
      updated_at: now,
    }).eq("id", session.run_id);
    return NextResponse.json({ success: true, accepted: normalized.length, total, target: session.target_candidate_count, completed: complete }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "후보 카드를 저장하지 못했습니다." }, { status: 500, headers: corsHeaders });
  }
}
