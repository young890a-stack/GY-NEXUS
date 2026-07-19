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
      mixStrategy?: unknown;
    };
    const playbackSpeed = Number(body.playbackSpeed);
    const allowedSpeeds = new Set([1, 1.2, 1.4]);
    const subtitleCleanupMode = String(body.subtitleCleanupMode || "recreate-clean");
    const sourceAudioMode = String(body.sourceAudioMode || "mute-korean-tts");
    const mixStrategy = String(body.mixStrategy || "recreate");
    if (!allowedSpeeds.has(playbackSpeed)) {
      return NextResponse.json({ success: false, message: "재생 속도는 1.0x, 1.2x, 1.4x 중에서 선택해주세요." }, { status: 400 });
    }
    if (!["recreate-clean", "safe-bottom-crop", "keep-licensed"].includes(subtitleCleanupMode)) {
      return NextResponse.json({ success: false, message: "올바른 중국어 자막 처리 방식을 선택해주세요." }, { status: 400 });
    }
    if (!["mute-korean-tts", "mute"].includes(sourceAudioMode)) {
      return NextResponse.json({ success: false, message: "올바른 원본 음성 처리 방식을 선택해주세요." }, { status: 400 });
    }
    if (!["licensed-only", "hybrid", "recreate"].includes(mixStrategy)) {
      return NextResponse.json({ success: false, message: "올바른 짜집기 방식을 선택해주세요." }, { status: 400 });
    }
    if (mixStrategy !== "recreate" && subtitleCleanupMode === "recreate-clean") {
      return NextResponse.json({ success: false, message: "허가 영상을 사용하는 짜집기 방식에서는 하단 안전 크롭 또는 원문 유지를 선택해주세요." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const currentSettings = record(project.settings);
    const mixModeChanged = String(currentSettings.subtitleCleanupMode || "recreate-clean") !== subtitleCleanupMode
      || String(currentSettings.mixStrategy || "recreate") !== mixStrategy;
    const changed = Number(currentSettings.playbackSpeed || 1.2) !== playbackSpeed
      || mixModeChanged
      || String(currentSettings.sourceAudioMode || "mute-korean-tts") !== sourceAudioMode;
    const now = new Date().toISOString();
    const nextSettings = {
      ...currentSettings,
      playbackSpeed,
      subtitleCleanupMode,
      sourceAudioMode,
      mixStrategy,
      editorSettingsUpdatedAt: now,
      ...(mixModeChanged ? { sourceMixPlan: null, sourceMixPlanUpdatedAt: null } : {}),
      ...(changed ? {
        contentApprovedAt: null,
        contentApprovalChecklist: null,
        voiceAudioUrl: null,
        voiceName: null,
      } : {}),
    };
    const { error: updateError } = await supabase.from("video_projects").update({
      settings: nextSettings,
      ...(changed ? { render_approved: false, render_approved_at: null } : {}),
      updated_at: now,
    }).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, settings: nextSettings, changed, message: changed ? "AI 편집 설정을 저장하고 이전 승인을 초기화했습니다." : "AI 편집 설정이 그대로라 기존 승인을 유지했습니다." });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "AI 편집 설정 저장에 실패했습니다.",
    }, { status: 500 });
  }
}
