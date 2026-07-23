import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const canva = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_canva_token")?.value);
  try {
    const [trends, videos, rules, projects, variants] = await Promise.all([
      supabase.from("growth_trends_v35").select("keyword,traffic,shopping_fit,rank,observed_at").order("observed_at", { ascending: false }).order("shopping_fit", { ascending: false }).limit(12),
      supabase.from("youtube_video_metrics_v35").select("video_id,title,views,average_view_percentage,attributed_clicks,conversions,revenue,commerce_score,synced_at").order("synced_at", { ascending: false }).order("commerce_score", { ascending: false }).limit(12),
      supabase.from("commerce_learning_rules_v35").select("rule_key,rule_type,segment,direction,score,lift_percent,sample_size,confidence,active,recommendation,updated_at").order("score", { ascending: false }).limit(12),
      supabase.from("video_projects").select("id", { count: "exact", head: true }).not("final_video_url", "is", null),
      supabase.from("shorts_production_variants_v34").select("id", { count: "exact", head: true }),
    ]);
    const errors = [trends.error, videos.error, rules.error].filter(Boolean);
    return NextResponse.json({
      success: true,
      setupRequired: errors.length > 0,
      canva: { configured: Boolean(process.env.CANVA_CLIENT_ID?.trim() && process.env.CANVA_CLIENT_SECRET?.trim()), connected: Boolean(canva?.access_token) },
      youtube: { configured: Boolean(process.env.YOUTUBE_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim()), connected: Boolean(request.cookies.get("gy_youtube_token")?.value) },
      counts: { renderedProjects: projects.count || 0, v34Variants: variants.count || 0 },
      trends: trends.data || [], videos: videos.data || [], rules: rules.data || [],
      message: errors.length ? "V3-5 SQL을 먼저 적용하면 전체 데이터가 표시됩니다." : "성장·판매 학습 엔진이 준비되었습니다.",
    });
  } catch (error) {
    return NextResponse.json({ success: false, setupRequired: true, canva: { configured: Boolean(process.env.CANVA_CLIENT_ID), connected: Boolean(canva?.access_token) }, trends: [], videos: [], rules: [], message: error instanceof Error ? error.message : "상태 조회 실패" });
  }
}
