import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeReferenceMaterial, normalizeMediaReferences } from "@/lib/creative-studio-pro/integration";

export const runtime = "nodejs";
export const maxDuration = 120;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { referenceId?: string };
    const referenceId = String(body.referenceId || "").trim();
    if (!referenceId) return NextResponse.json({ success: false, message: "분석할 참고 소재를 선택해주세요." }, { status: 400 });

    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    const references = normalizeMediaReferences(settings.mediaReferences);
    const reference = references.find((item) => item.id === referenceId);
    if (!reference) return NextResponse.json({ success: false, message: "참고 소재를 먼저 저장해주세요." }, { status: 404 });

    const analyzed = await analyzeReferenceMaterial({
      projectProductName: project.product_name,
      projectProductDescription: project.product_description || "",
      durationSeconds: Number(project.duration_seconds) || 20,
      reference,
    });
    const recommendedKeywords = analyzed.result.keywordCandidates
      .filter((item) => item.recommended)
      .map((item) => item.keyword)
      .slice(0, 8);
    const nextReferences = references.map((item) => item.id === referenceId ? {
      ...item,
      analysis: analyzed.result,
      selectedKeywords: item.selectedKeywords.length ? item.selectedKeywords : recommendedKeywords,
    } : item);
    const now = new Date().toISOString();
    const nextSettings = {
      ...settings,
      mediaReferences: nextReferences,
      mediaReferencesUpdatedAt: now,
      sourceMixPlan: null,
      sourceMixPlanUpdatedAt: null,
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
      analysis: analyzed.result,
      references: nextReferences,
      message: "상품·키워드·훅·프레임 유지/제거·영상 믹스 구조 분석을 완료했습니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "참고영상 장면 분석에 실패했습니다.",
    }, { status: 500 });
  }
}
