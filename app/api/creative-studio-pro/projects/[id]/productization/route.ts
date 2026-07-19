import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCommercePackage } from "@/lib/creative-studio-pro/commerce";
import {
  generateTrendIntelligence,
  gyProductCode,
  normalizeMediaReferences,
} from "@/lib/creative-studio-pro/integration";

export const runtime = "nodejs";
export const maxDuration = 180;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const { data: scenes, error: sceneError } = await supabase
      .from("video_scenes")
      .select("narration")
      .eq("project_id", id)
      .order("scene_number");
    if (sceneError) throw sceneError;

    const settings = record(project.settings);
    const mediaReferences = normalizeMediaReferences(settings.mediaReferences);
    const referenceNotes = mediaReferences
      .map((item) => [item.title, item.notes].filter(Boolean).join(": "))
      .filter(Boolean);
    const trend = await generateTrendIntelligence({
      productName: project.product_name,
      productDescription: project.product_description || "",
      durationSeconds: Number(project.duration_seconds) || 20,
      referenceNotes,
    });
    const productCode = typeof settings.gyProductCode === "string"
      ? settings.gyProductCode
      : gyProductCode(project.id);
    const commerce = await generateCommercePackage({
      productName: project.product_name,
      productDescription: project.product_description || "",
      durationSeconds: Number(project.duration_seconds) || 20,
      style: project.style || "cinematic-product",
      productUrl: typeof settings.productUrl === "string" ? settings.productUrl : undefined,
      affiliateUrl: typeof settings.affiliateUrl === "string" ? settings.affiliateUrl : undefined,
      platformTargets: Array.isArray(settings.platformTargets) ? settings.platformTargets.map(String) : undefined,
      sceneNarrations: (scenes || []).map((scene) => String(scene.narration || "")).filter(Boolean),
      productCode,
      trendIntelligence: trend.result,
    });
    const now = new Date().toISOString();
    const nextSettings = {
      ...settings,
      mediaReferences,
      gyProductCode: productCode,
      trendIntelligence: trend.result,
      trendIntelligenceUpdatedAt: now,
      commercePackage: commerce.result,
      commercePackageModel: commerce.model,
      commercePackageUpdatedAt: now,
      selectedHookIndex: null,
      selectedHook: null,
      contentApprovedAt: null,
      contentApprovalChecklist: null,
      voiceAudioUrl: null,
      voiceName: null,
    };
    const { error: updateError } = await supabase.from("video_projects").update({
      settings: nextSettings,
      render_approved: false,
      render_approved_at: null,
      updated_at: now,
    }).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({
      success: true,
      productCode,
      trendIntelligence: trend.result,
      package: commerce.result,
      message: "중국 탐색 키워드·독창적 장면 설계·4개 플랫폼 게시 패키지를 완성했습니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "쇼핑 쇼츠 통합 상품화 준비에 실패했습니다.",
    }, { status: 500 });
  }
}
