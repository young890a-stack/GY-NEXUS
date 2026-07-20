import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type MediaReference = {
  id: string;
  platform: string;
  url: string;
  title: string;
  assetKind: "video-file";
  rightsStatus: "owned" | "seller-provided" | "affiliate-provided" | "permission-confirmed";
  useInFinal: true;
  includeInMixAnalysis: true;
  notes: string;
  analysisFrameUrls: string[];
  selectedKeywords: string[];
  durationSeconds: number | null;
  trimStartSecond: number;
  trimEndSecond: number | null;
  createdAt: string;
};

type Cut = {
  order: number;
  startSecond: number;
  durationSeconds: number;
  sourceStartSecond: number;
  sourceEndSecond: number;
  referenceId: string;
  frameIndex: number;
  role: string;
  decision: "use-licensed";
  direction: string;
  subtitleIntent: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeHttps(value: unknown) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:") throw new Error("업로드된 HTTPS 파일 주소만 사용할 수 있습니다.");
  return url.toString();
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as {
      mediaReferences?: MediaReference[];
      cuts?: Cut[];
      commercePackage?: Record<string, unknown>;
      durationSeconds?: number;
      voiceAudioUrl?: string;
      customMusicUrl?: string;
      musicVolume?: number;
      subtitleStyle?: string;
      subtitleCleanupMode?: string;
      playbackSpeed?: number;
    };

    const references = Array.isArray(body.mediaReferences) ? body.mediaReferences.slice(0, 20) : [];
    const cuts = Array.isArray(body.cuts) ? body.cuts.slice(0, 60) : [];
    if (!references.length) return NextResponse.json({ success: false, message: "최종 합성에 사용할 직접 촬영·허가 영상이 없습니다." }, { status: 400 });
    if (!cuts.length) return NextResponse.json({ success: false, message: "최종 합성 컷 타임라인이 없습니다." }, { status: 400 });

    const referenceIds = new Set(references.map((item) => item.id));
    const normalizedReferences = references.map((item) => ({
      ...item,
      url: safeHttps(item.url),
      assetKind: "video-file" as const,
      useInFinal: true as const,
      includeInMixAnalysis: true as const,
      rightsStatus: item.rightsStatus || "owned",
      trimStartSecond: Math.max(0, Number(item.trimStartSecond) || 0),
      trimEndSecond: item.trimEndSecond == null ? item.durationSeconds : Math.max(0, Number(item.trimEndSecond) || 0),
    }));
    const normalizedCuts = cuts.map((cut, index) => {
      if (!referenceIds.has(cut.referenceId)) throw new Error(`컷 ${index + 1}의 영상 소스를 찾지 못했습니다.`);
      const duration = Math.max(.7, Math.min(2.5, Number(cut.durationSeconds) || 1.5));
      const sourceStartSecond = Math.max(0, Number(cut.sourceStartSecond) || 0);
      return {
        ...cut,
        order: index + 1,
        startSecond: Math.max(0, Number(cut.startSecond) || 0),
        durationSeconds: duration,
        sourceStartSecond,
        sourceEndSecond: Math.max(sourceStartSecond + duration, Number(cut.sourceEndSecond) || sourceStartSecond + duration),
        decision: "use-licensed" as const,
      };
    });

    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("id,settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");

    const settings = record(project.settings);
    const durationSeconds = Math.max(15, Math.min(30, Math.round(Number(body.durationSeconds) || 20)));
    const sourceMixPlan = {
      title: "GY Revenue Shorts 수동 승인 타임라인",
      totalDurationSeconds: durationSeconds,
      selectedReferenceIds: normalizedReferences.map((item) => item.id),
      cuts: normalizedCuts,
      safetySummary: "직접 촬영 또는 사용 허가가 확인된 업로드 파일만 최종 합성에 사용합니다.",
      generatedAt: new Date().toISOString(),
      model: "local-manual-plan-v1",
    };
    const now = new Date().toISOString();
    const voiceAudioUrl = body.voiceAudioUrl ? safeHttps(body.voiceAudioUrl) : "";
    const customMusicUrl = body.customMusicUrl ? safeHttps(body.customMusicUrl) : "";
    const nextSettings = {
      ...settings,
      mediaReferences: normalizedReferences,
      licensedFinalAssets: normalizedReferences,
      sourceMixPlan,
      commercePackage: body.commercePackage || {},
      contentApprovedAt: now,
      contentApprovalChecklist: {
        hook: true,
        claim: true,
        subtitle: true,
        affiliateDisclosure: true,
      },
      selectedHookIndex: 0,
      selectedHook: String(record(body.commercePackage).hookOptions && Array.isArray(record(body.commercePackage).hookOptions)
        ? (record(body.commercePackage).hookOptions as unknown[])[0] || ""
        : ""),
      voiceAudioUrl: voiceAudioUrl || null,
      customMusicUrl: customMusicUrl || null,
      musicVolume: Math.max(0, Math.min(.5, Number(body.musicVolume) || .1)),
      sourceAudioMode: voiceAudioUrl ? "mute-korean-tts" : "mute",
      subtitleStyle: ["bold-pop", "minimal"].includes(String(body.subtitleStyle)) ? body.subtitleStyle : "bold-pop",
      subtitleCleanupMode: body.subtitleCleanupMode === "keep-licensed" ? "keep-licensed" : "safe-bottom-crop",
      playbackSpeed: [1, 1.2, 1.4].includes(Number(body.playbackSpeed)) ? Number(body.playbackSpeed) : 1,
      mixStrategy: "licensed-only",
      revenueShortsVersion: "1.0.0",
      revenueShortsPreparedAt: now,
    };

    const { error: updateError } = await supabase.from("video_projects").update({
      duration_seconds: durationSeconds,
      settings: nextSettings,
      render_approved: true,
      render_approved_at: now,
      status: "planned",
      updated_at: now,
    }).eq("id", id);
    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      projectId: id,
      referenceCount: normalizedReferences.length,
      cutCount: normalizedCuts.length,
      message: "AI 비용 없이 직접 촬영·허가 영상 기반 최종 MP4 계획을 저장했습니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "무료 수동 렌더링 계획 저장에 실패했습니다.",
    }, { status: 500 });
  }
}
