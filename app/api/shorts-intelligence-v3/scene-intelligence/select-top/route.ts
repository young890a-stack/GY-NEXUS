import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const runId = String(body.runId || "").trim();
    const limit = Math.min(30, Math.max(1, Math.round(Number(body.limit) || 30)));
    if (!runId) return NextResponse.json({ success: false, message: "runId가 필요합니다." }, { status: 400 });
    const supabase = createAdminClient();
    const { data: candidates, error } = await supabase.from("china_video_candidates")
      .select("id,run_id,rights_status,total_intelligence_score,gemini_score")
      .eq("run_id", runId)
      .order("total_intelligence_score", { ascending: false })
      .order("gemini_score", { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!candidates?.length) return NextResponse.json({ success: false, message: "선별할 후보가 없습니다. V3-2 수집과 1차 분석을 먼저 완료해주세요." }, { status: 400 });
    await supabase.from("china_video_candidates").update({ selected_for_scene_analysis: false, scene_analysis_rank: null }).eq("run_id", runId);
    const selected = candidates.map((item, index) => ({ ...item, rank: index + 1 }));
    await Promise.all(selected.map((item) => supabase.from("china_video_candidates").update({
      selected_for_scene_analysis: true,
      scene_analysis_rank: item.rank,
      scene_analysis_status: "awaiting_source",
    }).eq("id", item.id)));
    const { error: upsertError } = await supabase.from("china_scene_analysis_jobs_v3").upsert(selected.map((item) => ({
      run_id: runId,
      candidate_id: item.id,
      rank: item.rank,
      rights_status: item.rights_status || "unverified",
      status: "awaiting_source",
      updated_at: new Date().toISOString(),
    })), { onConflict: "candidate_id" });
    if (upsertError) throw upsertError;
    return NextResponse.json({ success: true, selected: selected.length });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "상위 30개 선별에 실패했습니다." }, { status: 500 });
  }
}
