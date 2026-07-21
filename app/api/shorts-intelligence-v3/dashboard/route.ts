import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const [runs, candidates, opportunities, variants, sessions] = await Promise.all([
      supabase.from("china_discovery_runs").select("*").order("created_at", { ascending: false }).limit(8),
      supabase.from("china_video_candidates").select("*").order("total_intelligence_score", { ascending: false }).limit(24),
      supabase.from("affiliate_profit_opportunities").select("*,products(title,image_url,platform)").order("profit_score", { ascending: false }).limit(12),
      supabase.from("shorts_variant_jobs_v3").select("*,products(title,image_url)").order("created_at", { ascending: false }).limit(12),
      supabase.from("china_collector_sessions_v3").select("id,run_id,status,target_candidate_count,collected_candidate_count,last_platform,last_keyword,last_seen_at,expires_at,created_at").order("created_at", { ascending: false }).limit(8),
    ]);
    const firstError = [runs.error, candidates.error, opportunities.error, variants.error, sessions.error].find(Boolean);
    if (firstError) throw firstError;
    return NextResponse.json({
      success: true,
      runs: runs.data ?? [],
      candidates: candidates.data ?? [],
      opportunities: opportunities.data ?? [],
      variants: variants.data ?? [],
      collectorSessions: sessions.data ?? [],
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "V3 운영현황을 불러오지 못했습니다." }, { status: 500 });
  }
}
