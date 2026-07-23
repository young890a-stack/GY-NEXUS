import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeVideoFramesWithGemini, type GeminiSelectedCut } from "@/lib/creative-studio-pro/gemini-media-analysis";

export const runtime = "nodejs";
export const maxDuration = 180;

type Asset = {
  id: string;
  name: string;
  url: string;
  path?: string;
  mimeType: string;
  sizeBytes: number;
  rightsStatus: "owned";
  status: "uploaded" | "queued" | "extracting" | "analyzing" | "completed" | "failed";
  frameUrls: string[];
  frameTimestamps: number[];
  durationSeconds: number | null;
  analysis?: Awaited<ReturnType<typeof analyzeVideoFramesWithGemini>>;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function buildPlan(asset: Asset, cuts: GeminiSelectedCut[], target: number) {
  let cursor = 0;
  return {
    title: `${asset.name} Gemini 자동 선별`,
    totalDurationSeconds: Number(cuts.reduce((sum, item) => sum + item.durationSeconds, 0).toFixed(2)),
    selectedReferenceIds: [asset.id],
    cuts: cuts.map((cut, index) => {
      const startSecond = Number(cursor.toFixed(2));
      cursor += cut.durationSeconds;
      return {
        order: index + 1,
        startSecond,
        durationSeconds: cut.durationSeconds,
        sourceStartSecond: cut.sourceStartSecond,
        sourceEndSecond: cut.sourceEndSecond,
        referenceId: asset.id,
        frameIndex: cut.frameIndex,
        role: cut.role,
        decision: "use-licensed" as const,
        direction: cut.reason,
        subtitleIntent: cut.subtitleSuggestion,
      };
    }),
    safetySummary: "대표가 직접 촬영하거나 사용 권한을 확인한 영상만 사용합니다.",
    generatedAt: new Date().toISOString(),
    model: asset.analysis?.model || "gemini",
    targetDurationSeconds: target,
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const secret = process.env.VIDEO_WORKER_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: "인증 실패" }, { status: 401 });
    }
    const { id } = await context.params;
    const body = await request.json() as {
      status?: string;
      jobId?: string;
      stagedVideoUrl?: string;
      frameUrls?: string[];
      frameTimestamps?: number[];
      durationSeconds?: number;
      mimeType?: string;
      sourceBytes?: number;
      message?: string;
    };
    const assetId = String(body.jobId || "");
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings,duration_seconds,product_name,product_description").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    const assets = Array.isArray(settings.mediaAnalysisAssets) ? settings.mediaAnalysisAssets as Asset[] : [];
    const current = assets.find((item) => item.id === assetId);
    if (!current) return NextResponse.json({ success: false, message: "분석 소재를 찾지 못했습니다." }, { status: 404 });
    const now = new Date().toISOString();

    if (body.status === "failed") {
      const failed = assets.map((item) => item.id === assetId ? { ...item, status: "failed" as const, error: String(body.message || "프레임 추출 실패"), updatedAt: now } : item);
      await supabase.from("video_projects").update({ settings: { ...settings, mediaAnalysisAssets: failed }, updated_at: now }).eq("id", id);
      return NextResponse.json({ success: true });
    }

    const frameUrls = Array.isArray(body.frameUrls) ? body.frameUrls.map(String).slice(0, 12) : [];
    const frameTimestamps = Array.isArray(body.frameTimestamps) ? body.frameTimestamps.map(Number).slice(0, 12) : [];
    const durationSeconds = Math.max(1, Number(body.durationSeconds) || 1);
    const normalizedUrl = String(body.stagedVideoUrl || current.url);
    const analyzingAsset: Asset = {
      ...current,
      url: normalizedUrl,
      mimeType: String(body.mimeType || current.mimeType),
      sizeBytes: Math.max(current.sizeBytes, Number(body.sourceBytes) || 0),
      frameUrls,
      frameTimestamps,
      durationSeconds,
      status: "analyzing",
      error: "",
      updatedAt: now,
    };
    const analyzingAssets = assets.map((item) => item.id === assetId ? analyzingAsset : item);
    await supabase.from("video_projects").update({ settings: { ...settings, mediaAnalysisAssets: analyzingAssets }, updated_at: now }).eq("id", id);

    try {
      const analysis = await analyzeVideoFramesWithGemini({
        productName: String(project.product_name || "상품"),
        productDescription: String(project.product_description || ""),
        targetDurationSeconds: Math.max(15, Math.min(30, Number(project.duration_seconds) || 20)),
        frameUrls,
        frameTimestamps,
        sourceDurationSeconds: durationSeconds,
      });
      const completedAsset: Asset = { ...analyzingAsset, status: "completed", analysis, updatedAt: new Date().toISOString() };
      const nextAssets = analyzingAssets.map((item) => item.id === assetId ? completedAsset : item);
      const references = Array.isArray(settings.mediaReferences) ? settings.mediaReferences as Array<Record<string, unknown>> : [];
      const mediaReference = {
        id: completedAsset.id,
        platform: "owned",
        url: completedAsset.url,
        title: completedAsset.name,
        assetKind: "video-file",
        rightsStatus: "owned",
        useInFinal: true,
        includeInMixAnalysis: true,
        notes: "대표가 직접 촬영하거나 사용 권한을 확인한 영상. Gemini가 추천 구간을 자동 선별했습니다.",
        analysisFrameUrls: completedAsset.frameUrls.slice(0, 8),
        selectedKeywords: [],
        durationSeconds: completedAsset.durationSeconds,
        trimStartSecond: 0,
        trimEndSecond: completedAsset.durationSeconds,
        createdAt: completedAsset.createdAt,
      };
      const nextReferences = [...references.filter((item) => String(item.id || "") !== completedAsset.id), mediaReference].slice(0, 20);
      const target = Math.max(15, Math.min(30, Number(project.duration_seconds) || 20));
      const sourceMixPlan = buildPlan(completedAsset, analysis.recommendedCuts, target);
      const completedAt = new Date().toISOString();
      await supabase.from("video_projects").update({
        settings: {
          ...settings,
          mediaAnalysisAssets: nextAssets,
          mediaReferences: nextReferences,
          sourceMixPlan,
          mixStrategy: "licensed-only",
          sourceAudioMode: "mute-korean-tts",
          subtitleCleanupMode: "keep-licensed",
          geminiSelectedAssetId: completedAsset.id,
          geminiMediaUpdatedAt: completedAt,
        },
        render_approved: false,
        render_approved_at: null,
        updated_at: completedAt,
      }).eq("id", id);
      return NextResponse.json({ success: true });
    } catch (analysisError) {
      const failed = analyzingAssets.map((item) => item.id === assetId ? {
        ...item,
        status: "failed" as const,
        error: analysisError instanceof Error ? analysisError.message : "Gemini 분석 실패",
        updatedAt: new Date().toISOString(),
      } : item);
      await supabase.from("video_projects").update({ settings: { ...settings, mediaAnalysisAssets: failed }, updated_at: new Date().toISOString() }).eq("id", id);
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Gemini 소재 분석 콜백 실패" }, { status: 500 });
  }
}
