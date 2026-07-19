import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as {
      playbackSpeed?: unknown;
      subtitleCleanupMode?: unknown;
      sourceAudioMode?: unknown;
    };
    const playbackSpeed = Number(body.playbackSpeed);
    const allowedSpeeds = new Set([1, 1.2, 1.4]);
    const subtitleCleanupMode = String(body.subtitleCleanupMode || "recreate-clean");
    const sourceAudioMode = String(body.sourceAudioMode || "mute-korean-tts");
    if (!allowedSpeeds.has(playbackSpeed)) {
      return NextResponse.json({ success: false, message: "재생 속도는 1.0x, 1.2x, 1.4x 중에서 선택해주세요." }, { status: 400 });
    }
    if (!["recreate-clean", "safe-bottom-crop", "keep-licensed"].includes(subtitleCleanupMode)) {
      return NextResponse.json({ success: false, message: "올바른 중국어 자막 처리 방식을 선택해주세요." }, { status: 400 });
    }
    if (!["mute-korean-tts", "mute"].includes(sourceAudioMode)) {
      return NextResponse.json({ success: false, message: "올바른 원본 음성 처리 방식을 선택해주세요." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const now = new Date().toISOString();
    const nextSettings = {
      ...record(project.settings),
      playbackSpeed,
      subtitleCleanupMode,
      sourceAudioMode,
      editorSettingsUpdatedAt: now,
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
    return NextResponse.json({ success: true, settings: nextSettings, message: "AI 편집 설정을 저장했습니다." });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "AI 편집 설정 저장에 실패했습니다.",
    }, { status: 500 });
  }
}
