import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const runId = new URL(request.url).searchParams.get("runId")?.trim() || "";
    if (!runId) return NextResponse.json({ success: false, message: "runId가 필요합니다." }, { status: 400 });
    const supabase = createAdminClient();
    const { data: jobs, error } = await supabase.from("china_scene_analysis_jobs_v3")
      .select("*,china_video_candidates(id,title,platform,thumbnail_url,total_intelligence_score,gemini_score,scene_analysis_score)")
      .eq("run_id", runId).order("rank", { ascending: true });
    if (error) throw error;
    const jobIds = (jobs || []).map((item) => item.id);
    const { data: segments, error: segmentError } = jobIds.length
      ? await supabase.from("china_scene_segments_v3").select("*").in("job_id", jobIds).order("scene_index", { ascending: true })
      : { data: [], error: null };
    if (segmentError) throw segmentError;
    return NextResponse.json({ success: true, jobs: jobs || [], segments: segments || [] });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "장면 분석 상태를 불러오지 못했습니다." }, { status: 500 });
  }
}
