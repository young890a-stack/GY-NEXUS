import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCreativeVideo } from "@/lib/creative-studio/video";
export const runtime = "nodejs";
export const maxDuration = 800;
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (projectError || !project) throw projectError || new Error("프로젝트를 찾을 수 없습니다.");
    const { data: scene, error: sceneError } = await supabase.from("video_scenes").select("*").eq("project_id", id).in("status", ["pending","failed"]).order("scene_number").limit(1).maybeSingle();
    if (sceneError) throw sceneError;
    if (!scene) return NextResponse.json({ success: true, done: true, message: "모든 장면 생성이 완료되었습니다." });

    await supabase.from("video_projects").update({ status: "generating", updated_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("video_scenes").update({ status: "generating", error_message: null, updated_at: new Date().toISOString() }).eq("id", scene.id);
    try {
      const result = await generateCreativeVideo({
        title: `${project.title}-scene-${scene.scene_number}`,
        prompt: scene.prompt,
        sourceImageUrl: scene.scene_number === 1 ? project.source_image_url || undefined : undefined,
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
