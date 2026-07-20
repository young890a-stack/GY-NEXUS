import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeMediaReferences } from "@/lib/creative-studio-pro/integration";

export const runtime = "nodejs";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function safeHttps(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  const url = new URL(text);
  if (url.protocol !== "https:") throw new Error("오디오 주소는 HTTPS만 사용할 수 있습니다.");
  return url.toString();
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json() as {
      commercePackage?: Record<string, unknown>;
      voiceAudioUrl?: unknown;
      customMusicUrl?: unknown;
      musicVolume?: unknown;
      subtitleStyle?: unknown;
      subtitleCleanupMode?: unknown;
      playbackSpeed?: unknown;
    };

    const supabase = createAdminClient();
    const { data: project, error } = await supabase
      .from("video_projects")
      .select("id,settings")
      .eq("id", id)
      .single();

    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");

    const settings = record(project.settings);
    const sourceMixPlan = record(settings.sourceMixPlan);
    const references = normalizeMediaReferences(settings.mediaReferences);
    const licensedFinalAssets = references.filter(
      (item) => item.assetKind === "video-file"
        && item.useInFinal
        && item.rightsStatus !== "unverified",
    );

    if (!Array.isArray(sourceMixPlan.cuts) || !sourceMixPlan.cuts.length) {
      return NextResponse.json(
        { success: false, message: "먼저 AI 짜집기 컷 설계를 완료해주세요." },
        { status: 400 },
      );
    }

    if (!licensedFinalAssets.length) {
      return NextResponse.json(
        { success: false, message: "최종 합성에 사용할 허가 영상 파일이 없습니다." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const voiceAudioUrl = safeHttps(body.voiceAudioUrl);
    const customMusicUrl = safeHttps(body.customMusicUrl);

    const nextSettings = {
      ...settings,
      mediaReferences: references,
      licensedFinalAssets,
      commercePackage: body.commercePackage || {},
      contentApprovedAt: now,
      contentApprovalChecklist: {
        hook: true,
        claim: true,
        subtitle: true,
        affiliateDisclosure: true,
      },
      voiceAudioUrl: voiceAudioUrl || null,
      customMusicUrl: customMusicUrl || null,
      musicVolume: Math.max(0, Math.min(.5, Number(body.musicVolume) || .1)),
      sourceAudioMode: voiceAudioUrl ? "mute-korean-tts" : "mute",
      subtitleStyle: body.subtitleStyle === "minimal" ? "minimal" : "bold-pop",
      subtitleCleanupMode: body.subtitleCleanupMode === "keep-licensed"
        ? "keep-licensed"
        : "safe-bottom-crop",
      playbackSpeed: [1, 1.2, 1.4].includes(Number(body.playbackSpeed))
        ? Number(body.playbackSpeed)
        : 1,
      mixStrategy: "licensed-only",
      revenueShortsAiMixApprovedAt: now,
    };

    const { error: updateError } = await supabase
      .from("video_projects")
      .update({
        settings: nextSettings,
        render_approved: true,
        render_approved_at: now,
        status: "planned",
        updated_at: now,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      cutCount: (sourceMixPlan.cuts as unknown[]).length,
      message: "선택한 2~3개 영상의 AI 짜집기 계획을 최종 렌더링용으로 승인했습니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error
        ? error.message
        : "AI 짜집기 최종 승인에 실패했습니다.",
    }, { status: 500 });
  }
}
