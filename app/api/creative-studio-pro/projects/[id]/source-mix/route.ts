import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSelectedSourceMix, normalizeMediaReferences } from "@/lib/creative-studio-pro/integration";

export const runtime = "nodejs";
export const maxDuration = 120;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    const references = normalizeMediaReferences(settings.mediaReferences);
    const selectedReferences = references.filter((item) => item.includeInMixAnalysis);
    if (!selectedReferences.length) {
      return NextResponse.json({ success: false, message: "AI 믹스에 사용할 쇼츠 소스를 하나 이상 선택해주세요." }, { status: 400 });
    }

    const generated = await generateSelectedSourceMix({
      productName: String(project.product_name || project.title || "상품"),
      productDescription: String(project.product_description || ""),
      durationSeconds: Number(project.duration_seconds) || 20,
      references: selectedReferences,
    });
    const now = new Date().toISOString();
    const nextSettings = {
      ...settings,
      mediaReferences: references,
      sourceMixPlan: generated.result,
      sourceMixPlanUpdatedAt: now,
      contentApprovedAt: null,
      contentApprovalChecklist: null,
      selectedHookIndex: null,
      selectedHook: null,
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
      sourceMixPlan: generated.result,
      message: `선택한 ${selectedReferences.length}개 소스로 ${generated.result.cuts.length}컷 · ${generated.result.totalDurationSeconds}초 AI 믹스 설계를 완성했습니다.`,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "선택 소스 AI 믹스 설계에 실패했습니다.",
    }, { status: 500 });
  }
}
