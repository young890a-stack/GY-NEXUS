import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateV34Quality } from "@/lib/shorts-intelligence-v3/production-v34";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const variantId = String(body.variantId || "").trim();
    if (!variantId) return NextResponse.json({ success: false, message: "variantId가 필요합니다." }, { status: 400 });

    const supabase = createAdminClient();
    const { data: variant, error: variantError } = await supabase.from("shorts_production_variants_v34").select("*").eq("id", variantId).single();
    if (variantError || !variant) throw variantError || new Error("V3-4 제작안을 찾지 못했습니다.");
    if (!variant.video_project_id) throw new Error("연결된 영상 프로젝트가 없습니다.");

    const [{ data: project, error: projectError }, { data: scenes, error: scenesError }] = await Promise.all([
      supabase.from("video_projects").select("*").eq("id", variant.video_project_id).single(),
      supabase.from("video_scenes").select("*").eq("project_id", variant.video_project_id).order("scene_number"),
    ]);
    if (projectError || !project) throw projectError || new Error("영상 프로젝트를 찾지 못했습니다.");
    if (scenesError) throw scenesError;

    const threshold = Math.max(88, Math.min(95, Number(variant.quality_threshold || project.quality_threshold) || 90));
    const quality = calculateV34Quality({
      project,
      scenes: (scenes || []) as Array<Record<string, any>>,
      planScore: Number(variant.plan_score) || 0,
      threshold,
    });

    let status = String(variant.status || "project_ready");
    if (project.status === "render_failed" || project.status === "failed") status = "failed";
    else if (project.status === "rendering") status = "rendering";
    else if (project.final_video_url) status = quality.passed ? "quality_passed" : "revision_required";
    else if ((scenes || []).length > 0 && (scenes || []).every((scene: Record<string, any>) => scene.status === "completed" && scene.video_url)) status = "clips_ready";
    else if (project.render_approved) status = "runway_approved";
    else if ((scenes || []).length > 0 && (scenes || []).every((scene: Record<string, any>) => scene.quality_status === "approved")) status = "images_ready";
    else if ((scenes || []).some((scene: Record<string, any>) => ["generating", "reviewing"].includes(scene.quality_status))) status = "images_generating";
    if (variant.status === "approved" && quality.passed) status = "approved";

    const thumbnailUrl = (scenes || []).find((scene: Record<string, any>) => scene.selected_image_url)?.selected_image_url || variant.thumbnail_url || null;
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase.from("shorts_production_variants_v34").update({
      status,
      final_score: quality.score,
      quality_report: quality,
      final_video_url: project.final_video_url || null,
      thumbnail_url: thumbnailUrl,
      updated_at: now,
    }).eq("id", variantId).select("*").single();
    if (updateError) throw updateError;

    const { data: siblings } = await supabase.from("shorts_production_variants_v34").select("status").eq("batch_id", variant.batch_id);
    const allQualityReady = Boolean(siblings?.length) && siblings!.every((item: Record<string, any>) => ["quality_passed", "approved"].includes(item.status));
    const anyApproved = Boolean(siblings?.some((item: Record<string, any>) => item.status === "approved"));
    await supabase.from("shorts_production_batches_v34").update({
      status: anyApproved ? "approved" : allQualityReady ? "quality_ready" : "production",
      updated_at: now,
    }).eq("id", variant.batch_id);

    return NextResponse.json({ success: true, variant: updated, quality, project, scenes: scenes || [] });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "V3-4 품질 상태 동기화에 실패했습니다." }, { status: 500 });
  }
}
