import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCreativeVideo } from "@/lib/creative-studio/video";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (projectError || !project) throw projectError || new Error("프로젝트를 찾을 수 없습니다.");
    if (!project.render_approved) {
      return NextResponse.json({ success: false, message: "Runway 유료 생성을 먼저 대표 승인해주세요." }, { status: 403 });
    }
    const { data: scene, error: sceneError } = await supabase.from("video_scenes").select("*").eq("project_id", id).eq("quality_status", "approved").in("status", ["pending","failed"]).order("scene_number").limit(1).maybeSingle();
    if (sceneError) throw sceneError;
    if (!scene) return NextResponse.json({ success: true, done: true, message: "모든 장면 생성이 완료되었습니다." });
    if (!scene.selected_image_url) {
      return NextResponse.json({ success: false, message: "품질검수를 통과한 장면 이미지가 없어 Runway 생성을 차단했습니다." }, { status: 409 });
    }

    await supabase.from("video_projects").update({ status: "generating", updated_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("video_scenes").update({ status: "generating", error_message: null, updated_at: new Date().toISOString() }).eq("id", scene.id);
    try {
      const result = await generateCreativeVideo({
        title: `${project.title}-scene-${scene.scene_number}`,
        prompt: scene.prompt,
        sourceImageUrl: scene.selected_image_url,
        duration: 5,
        ratio: project.ratio,
      });
      await supabase.from("video_scenes").update({ status: "completed", video_url: result.assetUrl, provider_task_id: result.taskId, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", scene.id);
      const { count } = await supabase.from("video_scenes").select("id", { count: "exact", head: true }).eq("project_id", id).neq("status", "completed");
      if ((count || 0) === 0) await supabase.from("video_projects").update({ status: "clips_completed", updated_at: new Date().toISOString() }).eq("id", id);
      return NextResponse.json({ success: true, done: (count || 0) === 0, scene: { ...scene, status: "completed", video_url: result.assetUrl } });
    } catch (error) {
      await supabase.from("video_scenes").update({ status: "failed", error_message: error instanceof Error ? error.message : String(error), updated_at: new Date().toISOString() }).eq("id", scene.id);
      throw error;
    }
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "장면 생성 실패" }, { status: 500 }); }
}
