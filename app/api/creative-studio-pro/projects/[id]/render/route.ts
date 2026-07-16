import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const { data: scenes, error: sceneError } = await supabase.from("video_scenes").select("*").eq("project_id", id).order("scene_number");
    if (sceneError) throw sceneError;
    if (!scenes?.length || scenes.some((scene) => scene.status !== "completed" || !scene.video_url)) return NextResponse.json({ success: false, message: "모든 장면 영상을 먼저 생성해주세요." }, { status: 400 });

    const workerUrl = process.env.VIDEO_WORKER_URL?.replace(/\/$/, "");
    if (!workerUrl) {
      await supabase.from("video_projects").update({ status: "worker_required", updated_at: new Date().toISOString() }).eq("id", id);
      return NextResponse.json({ success: false, workerRequired: true, message: "최종 MP4 합성에는 FFmpeg 영상 Worker가 필요합니다. VIDEO_WORKER_URL을 연결하면 장면 연결·자막·음성·음악 합성이 실행됩니다." }, { status: 409 });
    }
    await supabase.from("video_projects").update({ status: "rendering", updated_at: new Date().toISOString() }).eq("id", id);
    const response = await fetch(`${workerUrl}/render`, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.VIDEO_WORKER_SECRET ? { Authorization: `Bearer ${process.env.VIDEO_WORKER_SECRET}` } : {}) }, body: JSON.stringify({ project, scenes, callbackUrl: `${new URL(_.url).origin}/api/creative-studio-pro/projects/${id}/render-callback` }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "영상 Worker가 렌더링 요청을 거부했습니다.");
    await supabase.from("video_render_jobs").insert({ project_id: id, worker_job_id: result.jobId || null, status: "queued", request_payload: { project, scenes } });
    return NextResponse.json({ success: true, message: "최종 영상 렌더링을 시작했습니다.", jobId: result.jobId || null });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "렌더링 요청 실패" }, { status: 500 }); }
}
