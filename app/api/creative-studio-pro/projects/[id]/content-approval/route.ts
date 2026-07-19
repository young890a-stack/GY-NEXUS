import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalUseRightsViolations } from "@/lib/creative-studio-pro/integration";
import { createExactSubtitleCues } from "@/lib/creative-studio-pro/commerce";

export const runtime = "nodejs";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { hookIndex?: number };
    const hookIndex = Number(body.hookIndex);
    if (!Number.isInteger(hookIndex) || hookIndex < 0 || hookIndex > 2) {
      return NextResponse.json({ success: false, message: "첫 3초에 사용할 훅을 하나 선택해주세요." }, { status: 400 });
    }
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("id,product_description,duration_seconds,settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    const commerce = record(settings.commercePackage);
    const qualityAudit = record(commerce.qualityAudit);
    const hooks = Array.isArray(commerce.hookOptions) ? commerce.hookOptions.map(String) : [];
    if (!settings.trendIntelligence || hooks.length !== 3) {
      return NextResponse.json({ success: false, message: "먼저 ‘쇼핑 쇼츠 상품화 준비’를 실행해주세요." }, { status: 400 });
    }
    if (qualityAudit.approved !== true) {
      const issues = Array.isArray(qualityAudit.issues) ? qualityAudit.issues.map(String).filter(Boolean) : [];
      return NextResponse.json({ success: false, message: `독립 광고 품질검수를 통과하지 못했습니다.${issues.length ? ` ${issues.join(" · ")}` : " 상품화 준비를 다시 실행해주세요."}` }, { status: 400 });
    }
    if (!String(project.product_description || "").trim()) {
      return NextResponse.json({ success: false, message: "허위 표현 검수를 위해 확인된 상품 설명을 먼저 입력한 프로젝트가 필요합니다." }, { status: 400 });
    }
    const rightsViolations = finalUseRightsViolations(settings.mediaReferences);
    if (rightsViolations.length > 0) {
      return NextResponse.json({ success: false, message: `권리 미확인 소재의 최종 사용을 해제해주세요: ${rightsViolations.join(", ")}` }, { status: 400 });
    }
    const selectedHook = hooks[hookIndex];
    let bodyVoiceover = String(commerce.voiceover || "").replace(/\s+/g, " ").trim();
    for (const hook of hooks) {
      if (bodyVoiceover.startsWith(hook)) bodyVoiceover = bodyVoiceover.slice(hook.length).trim();
    }
    const approvedVoiceover = `${selectedHook} ${bodyVoiceover}`.replace(/\s+/g, " ").trim();
    const subtitleCues = createExactSubtitleCues(approvedVoiceover, Number(project.duration_seconds) || 20);
    const cueText = subtitleCues.map((cue) => {
      const item = record(cue);
      return String(item.text || "").trim();
    }).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const voiceover = approvedVoiceover;
    if (!subtitleCues.length || cueText !== voiceover) {
      return NextResponse.json({ success: false, message: "AI 음성 대본과 글자가 정확히 일치하는 SRT가 없어 승인할 수 없습니다. 상품화 준비를 다시 실행해주세요." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const nextSettings = {
      ...settings,
      selectedHookIndex: hookIndex,
      selectedHook,
      commercePackage: {
        ...commerce,
        voiceover: approvedVoiceover,
        subtitleCues,
      },
      contentApprovedAt: now,
      contentApprovalChecklist: {
        rights: true,
        productMatch: true,
        claimSafety: true,
        subtitleComplete: true,
        firstThreeSecondsHook: true,
      },
      voiceAudioUrl: null,
      voiceName: null,
    };
    const { error: updateError } = await supabase.from("video_projects").update({ settings: nextSettings, render_approved: false, render_approved_at: null, updated_at: now }).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, message: `훅 ${hookIndex + 1}번으로 콘텐츠 품질 승인을 완료했습니다.` });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "콘텐츠 승인에 실패했습니다." }, { status: 500 });
  }
}
