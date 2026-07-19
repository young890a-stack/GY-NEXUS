import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCreativeVideo } from "@/lib/creative-studio/video";
import { finalUseRightsViolations } from "@/lib/creative-studio-pro/integration";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (projectError || !project) throw projectError || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? project.settings as Record<string, unknown>
      : {};
    if (!settings.contentApprovedAt) {
      return NextResponse.json({ success: false, message: "훅과 콘텐츠 품질을 먼저 대표 승인해주세요." }, { status: 403 });
    }
    if (finalUseRightsViolations(settings.mediaReferences).length) {
      return NextResponse.json({ success: false, message: "권리 미확인 소재가 최종 사용으로 선택되어 Runway 생성을 차단했습니다." }, { status: 403 });
    }
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
      const motionPrompt = [
        scene.prompt,
        "제공된 승인 이미지를 첫 프레임이자 상품 정체성 잠금 기준으로 사용한다.",
        "상품의 실루엣, 색상, 재질, 버튼, 포트, 로고, 구성품과 비율을 영상 끝까지 절대 바꾸지 않는다.",
        "제품이 녹거나 휘거나 다른 물체로 변형되지 않으며 새로운 글자, 로고, 버튼, 구성품이 생기지 않는다.",
        "손과 관절은 자연스럽고 손가락 수가 정확하며 제품을 가리지 않는다.",
        "한 장면에는 하나의 작고 현실적인 동작만 사용하고, 빠른 회전·급격한 줌·과도한 입자·폭발 효과를 사용하지 않는다.",
        "카메라 움직임은 느리고 안정적이며 실제 프리미엄 상품 촬영처럼 자연스럽다.",
      ].join(" ");
      const result = await generateCreativeVideo({
        title: `${project.title}-scene-${scene.scene_number}`,
        prompt: motionPrompt,
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
