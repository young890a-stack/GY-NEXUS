import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("china_discovery_runs")
      .select("*,china_video_candidates(id,total_intelligence_score)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return NextResponse.json({ success: true, runs: data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "수집 작업을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const query = String(body.query || "").replace(/\s+/g, " ").trim();
    if (query.length < 2 || query.length > 120) {
      return NextResponse.json({ success: false, message: "상품명 또는 키워드를 2~120자로 입력해주세요." }, { status: 400 });
    }
    const requestedTarget = Math.round(Number(body.targetCandidateCount) || 150);
    const targetCandidateCount = Math.min(300, Math.max(20, requestedTarget));
    const rawPlatforms = Array.isArray(body.platforms) ? body.platforms.map(String) : ["douyin", "xiaohongshu"];
    const platforms = rawPlatforms.filter((item) => item === "douyin" || item === "xiaohongshu");
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("china_discovery_runs").insert({
      query,
      translated_product_name: String(body.translatedProductName || "").trim() || null,
      platforms: platforms.length ? platforms : ["douyin", "xiaohongshu"],
      keyword_plan: Array.isArray(body.keywordPlan) ? body.keywordPlan.slice(0, 20) : [],
      target_candidate_count: targetCandidateCount,
      source_mode: "account-assisted",
      gemini_provider: String(body.geminiProvider || "").trim() || null,
      gemini_model: String(body.geminiModel || "").trim() || null,
      collector_status: "idle",
      status: "collecting",
      started_at: new Date().toISOString(),
    }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ success: true, run: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "수집 작업을 만들지 못했습니다." }, { status: 500 });
  }
}
