import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  candidateTriageManualPrompt,
  clampScore,
  getGeminiDiscoveryApiKey,
  getGeminiDiscoveryModel,
  triageCandidatesWithGemini,
  type CandidateTriageResult,
} from "@/lib/shorts-intelligence-v3/gemini-discovery";

export const runtime = "nodejs";
export const maxDuration = 60;

function candidatePayload(item: Record<string, unknown>) {
  return {
    id: item.id,
    platform: item.platform,
    title: item.title,
    author: item.author,
    postedAt: item.posted_at,
    views: item.views,
    likes: item.likes,
    comments: item.comments,
    saves: item.saves,
    shares: item.shares,
    searchRank: item.search_rank,
    repeatedExposureCount: item.repeated_exposure_count,
    keywordHits: item.keyword_hits,
    popularityScore: item.popularity_score,
    thumbnailUrl: item.thumbnail_url,
    rightsStatus: item.rights_status,
  };
}

function validateManualResults(value: unknown, allowedIds: Set<string>) {
  const rows = Array.isArray(value) ? value : [];
  return rows.flatMap((input) => {
    const item = input as Partial<CandidateTriageResult>;
    const id = String(item.id || "");
    if (!allowedIds.has(id)) return [];
    return [{
      id,
      relevanceScore: clampScore(item.relevanceScore),
      visualSellabilityScore: clampScore(item.visualSellabilityScore),
      hookPotentialScore: clampScore(item.hookPotentialScore),
      riskScore: clampScore(item.riskScore),
      summary: String(item.summary || "").slice(0, 300),
      hookPattern: String(item.hookPattern || "").slice(0, 160),
      sellingAngle: String(item.sellingAngle || "").slice(0, 160),
      riskFlags: Array.isArray(item.riskFlags) ? item.riskFlags.map(String).slice(0, 8) : [],
      recommended: Boolean(item.recommended),
    }];
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const runId = String(body.runId || "").trim();
    const mode = String(body.mode || "auto");
    const limit = Math.min(12, Math.max(1, Math.round(Number(body.limit) || 12)));
    if (!runId) return NextResponse.json({ success: false, message: "runId가 필요합니다." }, { status: 400 });
    const supabase = createAdminClient();
    const { data: run, error: runError } = await supabase.from("china_discovery_runs")
      .select("id,query,collected_candidate_count,analyzed_candidate_count").eq("id", runId).single();
    if (runError || !run) throw runError || new Error("수집 작업을 찾지 못했습니다.");
    const candidateIds = Array.isArray(body.candidateIds) ? body.candidateIds.map(String).filter(Boolean).slice(0, 12) : [];
    let candidateQuery = supabase.from("china_video_candidates")
      .select("id,platform,title,author,posted_at,thumbnail_url,views,likes,comments,saves,shares,search_rank,repeated_exposure_count,keyword_hits,popularity_score,rights_status,raw_data")
      .eq("run_id", runId).eq("gemini_status", "pending");
    if (mode === "manual-import" && candidateIds.length) candidateQuery = candidateQuery.in("id", candidateIds);
    const { data: candidates, error: candidatesError } = await candidateQuery.order("popularity_score", { ascending: false }).limit(limit);
    if (candidatesError) throw candidatesError;
    const rows = (candidates ?? []) as Array<Record<string, unknown>>;
    if (!rows.length) return NextResponse.json({ success: true, analyzed: 0, remaining: 0, completed: true });
    const payload = rows.map(candidatePayload);
    if (mode === "manual-export") {
      return NextResponse.json({
        success: true,
        mode: "gemini-pro-manual",
        manualPrompt: candidateTriageManualPrompt(run.query, payload),
        candidates: payload,
      });
    }
    let results: CandidateTriageResult[];
    if (mode === "manual-import") {
      results = validateManualResults(body.results, new Set(rows.map((item) => String(item.id))));
    } else {
      if (!getGeminiDiscoveryApiKey()) {
        return NextResponse.json({
          success: false,
          code: "GEMINI_API_KEY_REQUIRED",
          message: "Gemini API 키가 없습니다. Gemini Pro 직접 분석 모드를 사용해주세요.",
          manualPrompt: candidateTriageManualPrompt(run.query, payload),
          candidates: payload,
        }, { status: 409 });
      }
      results = await triageCandidatesWithGemini(run.query, payload);
    }
    if (!results.length) return NextResponse.json({ success: false, message: "분석 결과가 비어 있습니다." }, { status: 400 });
    const sourceById = new Map(rows.map((item) => [String(item.id), item]));
    await Promise.all(results.map(async (result) => {
      const source = sourceById.get(result.id);
      if (!source) return;
      const popularity = clampScore(source.popularity_score);
      const adjustedVisual = Math.round(result.visualSellabilityScore * 0.75 + result.hookPotentialScore * 0.25);
      const total = Math.round(Math.max(0, Math.min(100,
        popularity * 0.4 + result.relevanceScore * 0.35 + adjustedVisual * 0.25 - result.riskScore * 0.12,
      )));
      const rawData = source.raw_data && typeof source.raw_data === "object" ? source.raw_data as Record<string, unknown> : {};
      await supabase.from("china_video_candidates").update({
        relevance_score: result.relevanceScore,
        visual_sellability_score: adjustedVisual,
        total_intelligence_score: total,
        gemini_score: Math.round((result.relevanceScore + adjustedVisual + result.hookPotentialScore + (100 - result.riskScore)) / 4),
        gemini_status: "completed",
        gemini_analysis: result,
        analyzed_at: new Date().toISOString(),
        raw_data: { ...rawData, geminiTriage: result },
      }).eq("id", result.id);
    }));
    const { count: analyzedCount } = await supabase.from("china_video_candidates")
      .select("id", { count: "exact", head: true }).eq("run_id", runId).eq("gemini_status", "completed");
    const { count: remainingCount } = await supabase.from("china_video_candidates")
      .select("id", { count: "exact", head: true }).eq("run_id", runId).eq("gemini_status", "pending");
    await supabase.from("china_discovery_runs").update({
      analyzed_candidate_count: analyzedCount || 0,
      gemini_provider: mode === "manual-import" ? "gemini-pro-manual" : "gemini-api",
      gemini_model: mode === "manual-import" ? "Gemini Pro app" : getGeminiDiscoveryModel(),
      status: (remainingCount || 0) === 0 ? "completed" : "analyzing",
      completed_at: (remainingCount || 0) === 0 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
    return NextResponse.json({ success: true, analyzed: results.length, totalAnalyzed: analyzedCount || 0, remaining: remainingCount || 0, completed: (remainingCount || 0) === 0 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Gemini 후보 분석에 실패했습니다." }, { status: 500 });
  }
}
