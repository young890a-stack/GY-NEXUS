import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeMediaReferences } from "@/lib/creative-studio-pro/integration";

export const runtime = "nodejs";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { references?: unknown };
    const references = normalizeMediaReferences(body.references);
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("id,settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    const savedReferences = normalizeMediaReferences(settings.mediaReferences);
    if (JSON.stringify(savedReferences) === JSON.stringify(references)) {
      return NextResponse.json({
        success: true,
        unchanged: true,
        references,
        message: "변경된 소재 정보가 없어 기존 검수 결과를 그대로 유지했습니다.",
      });
    }
    const nextSettings = {
      ...settings,
      mediaReferences: references,
      mediaReferencesUpdatedAt: new Date().toISOString(),
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
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({
      success: true,
      references,
      message: "소재 권리 상태를 저장했습니다. 권리 미확인 자료의 최종 사용은 자동으로 해제됩니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "소재 권리 정보 저장에 실패했습니다.",
    }, { status: 400 });
  }
}
