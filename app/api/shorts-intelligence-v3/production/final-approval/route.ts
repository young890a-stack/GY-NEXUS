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
    if (!variant.video_project_id) throw new Error("영상 프로젝트가 연결되지 않았습니다.");
    const [{ data: project, error: projectError }, { data: scenes, error: scenesError }] = await Promise.all([
      supabase.from("video_projects").select("*").eq("id", variant.video_project_id).single(),
      supabase.from("video_scenes").select("*").eq("project_id", variant.video_project_id).order("scene_number"),
    ]);
    if (projectError || !project) throw projectError || new Error("영상 프로젝트를 찾지 못했습니다.");
    if (scenesError) throw scenesError;
    const threshold = Math.max(88, Math.min(95, Number(variant.quality_threshold || project.quality_threshold) || 90));
    const quality = calculateV34Quality({ project, scenes: (scenes || []) as Array<Record<string, any>>, planScore: Number(variant.plan_score) || 0, threshold });
    if (!quality.passed) {
      return NextResponse.json({ success: false, message: quality.summary, quality }, { status: 400 });
    }
    const now = new Date().toISOString();
    const thumbnailUrl = (scenes || []).find((scene: Record<string, any>) => scene.selected_image_url)?.selected_image_url || variant.thumbnail_url || null;
    const { data: updated, error: updateError } = await supabase.from("shorts_production_variants_v34").update({
      status: "approved",
      final_score: quality.score,
      quality_report: quality,
      final_video_url: project.final_video_url,
      thumbnail_url: thumbnailUrl,
      approved_at: now,
      updated_at: now,
    }).eq("id", variantId).select("*").single();
    if (updateError) throw updateError;
    await supabase.from("shorts_production_batches_v34").update({ status: "approved", approved_variant_id: variantId, updated_at: now }).eq("id", variant.batch_id);
    return NextResponse.json({ success: true, variant: updated, quality, message: `${variant.variant_key}안을 대표 최종 승인했습니다.` });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "V3-4 최종 승인에 실패했습니다." }, { status: 500 });
  }
}
