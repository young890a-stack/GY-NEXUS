import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const secret = process.env.VIDEO_WORKER_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: "인증 실패" }, { status: 401 });
    }
    const body = await request.json() as Record<string, unknown>;
    const jobId = String(body.jobId || "").trim();
    if (!jobId) return NextResponse.json({ success: false, message: "jobId가 필요합니다." }, { status: 400 });
    const supabase = createAdminClient();
    const { data: job, error } = await supabase.from("china_scene_analysis_jobs_v3").select("id,candidate_id").eq("id", jobId).single();
    if (error || !job) throw error || new Error("장면 작업을 찾지 못했습니다.");
    if (body.status === "failed") {
      const message = String(body.message || "프레임 추출 실패").slice(0, 2000);
      await supabase.from("china_scene_analysis_jobs_v3").update({ status: "failed", error_message: message, updated_at: new Date().toISOString() }).eq("id", jobId);
      await supabase.from("china_video_candidates").update({ scene_analysis_status: "failed" }).eq("id", job.candidate_id);
      return NextResponse.json({ success: true });
    }
    const frameUrls = Array.isArray(body.frameUrls) ? body.frameUrls.map(String).filter(Boolean).slice(0, 16) : [];
    const timestamps = Array.isArray(body.frameTimestamps) ? body.frameTimestamps.map(Number).filter(Number.isFinite).slice(0, 16) : [];
    const stagedVideoUrl = String(body.stagedVideoUrl || "").trim();
    const duration = Math.max(0, Number(body.durationSeconds) || 0);
    const sourceBytes = Math.max(0, Math.round(Number(body.sourceBytes) || 0));
    const mimeType = String(body.mimeType || "video/mp4").slice(0, 100);
    await supabase.from("china_scene_analysis_jobs_v3").update({
      status: "frames_ready",
      source_video_url: stagedVideoUrl,
      source_video_mime: mimeType,
      source_video_bytes: sourceBytes,
      duration_seconds: duration,
      frame_urls: frameUrls,
      frame_timestamps: timestamps,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    await supabase.from("china_video_candidates").update({
      source_video_url: stagedVideoUrl,
      source_video_mime: mimeType,
      source_video_bytes: sourceBytes,
      source_duration_seconds: duration,
      analysis_frame_urls: frameUrls,
      scene_analysis_status: "frames_ready",
    }).eq("id", job.candidate_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "프레임 콜백 처리 실패" }, { status: 500 });
  }
}
