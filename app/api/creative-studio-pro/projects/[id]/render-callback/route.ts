import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const workerSecret = process.env.VIDEO_WORKER_SECRET?.trim();
    if (!workerSecret || request.headers.get("authorization") !== `Bearer ${workerSecret}`) {
      return NextResponse.json({ success: false, message: "인증 실패" }, { status: 401 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createAdminClient();
    if (body.status === "completed" && body.finalVideoUrl) {
      await supabase.from("video_projects").update({ status: "completed", final_video_url: body.finalVideoUrl, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
      await supabase.from("video_render_jobs").update({ status: "completed", output_url: body.finalVideoUrl, completed_at: new Date().toISOString() }).eq("project_id", id).in("status", ["queued","rendering"]);
    } else if (body.status === "failed") {
      await supabase.from("video_projects").update({ status: "render_failed", error_message: body.message || "렌더링 실패", updated_at: new Date().toISOString() }).eq("id", id);
      await supabase.from("video_render_jobs").update({ status: "failed", error_message: body.message || "렌더링 실패" }).eq("project_id", id).in("status", ["queued","rendering"]);
    }
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "콜백 처리 실패" }, { status: 500 }); }
}
