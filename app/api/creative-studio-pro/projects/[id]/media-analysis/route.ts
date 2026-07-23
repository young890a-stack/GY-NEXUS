import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GeminiMediaAnalysis, GeminiSelectedCut } from "@/lib/creative-studio-pro/gemini-media-analysis";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  analysis?: GeminiMediaAnalysis;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function assetsFrom(settings: Record<string, unknown>) {
  return Array.isArray(settings.mediaAnalysisAssets) ? settings.mediaAnalysisAssets as Asset[] : [];
}

function normalizeCuts(cuts: GeminiSelectedCut[], sourceDuration: number, target: number) {
  let outputCursor = 0;
  return cuts.slice(0, 12).flatMap((cut, index) => {
    if (outputCursor >= target - .7) return [];
    const sourceStartSecond = Math.max(0, Math.min(sourceDuration - .7, Number(cut.sourceStartSecond) || 0));
    const requestedDuration = Math.max(.7, Math.min(2.5, Number(cut.sourceEndSecond) - sourceStartSecond || Number(cut.durationSeconds) || 1.5));
    const durationSeconds = Math.min(requestedDuration, target - outputCursor);
    if (durationSeconds < .7) return [];
    const result = {
      ...cut,
      order: index + 1,
      sourceStartSecond: Number(sourceStartSecond.toFixed(2)),
      sourceEndSecond: Number(Math.min(sourceDuration, sourceStartSecond + durationSeconds).toFixed(2)),
      durationSeconds: Number(durationSeconds.toFixed(2)),
      score: Math.max(0, Math.min(100, Math.round(Number(cut.score) || 0))),
      role: String(cut.role || "제품 사용 장면").slice(0, 80),
      reason: String(cut.reason || "Gemini 추천 구간").slice(0, 240),
      subtitleSuggestion: String(cut.subtitleSuggestion || "제품 핵심 확인").slice(0, 80),
    };
    outputCursor += durationSeconds;
    return [result];
  });
}

function mixPlan(asset: Asset, cuts: GeminiSelectedCut[], target: number) {
  let cursor = 0;
  const timelineCuts = cuts.map((cut, index) => {
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
  });
  return {
    title: `${asset.name} Gemini 자동 선별`,
    totalDurationSeconds: Number(Math.min(target, cursor).toFixed(2)),
    selectedReferenceIds: [asset.id],
    cuts: timelineCuts,
    safetySummary: "대표가 직접 촬영하거나 사용 권한을 확인한 영상만 최종 컷으로 사용합니다.",
    generatedAt: new Date().toISOString(),
    model: asset.analysis?.model || "gemini",
  };
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { data: project, error } = await createAdminClient().from("video_projects").select("settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    return NextResponse.json({ success: true, assets: assetsFrom(record(project.settings)) });
  } catch (error) {
    return NextResponse.json({ success: false, assets: [], message: error instanceof Error ? error.message : "소재 분석 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { name?: string; url?: string; path?: string; mimeType?: string; sizeBytes?: number };
    const url = String(body.url || "").trim();
    if (!url.startsWith("https://")) return NextResponse.json({ success: false, message: "업로드된 HTTPS 영상 주소가 필요합니다." }, { status: 400 });
    const workerUrl = process.env.VIDEO_WORKER_URL?.replace(/\/$/, "");
    const secret = process.env.VIDEO_WORKER_SECRET?.trim();
    if (!workerUrl || !secret) return NextResponse.json({ success: false, message: "Render 영상 Worker 연결값이 없습니다." }, { status: 409 });

    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings,duration_seconds").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    const now = new Date().toISOString();
    const asset: Asset = {
      id: `gemini-media-${Date.now()}`,
      name: String(body.name || "내 촬영 영상").slice(0, 140),
      url,
      path: String(body.path || ""),
      mimeType: String(body.mimeType || "video/mp4"),
      sizeBytes: Math.max(0, Number(body.sizeBytes) || 0),
      rightsStatus: "owned",
      status: "queued",
      frameUrls: [],
      frameTimestamps: [],
      durationSeconds: null,
      createdAt: now,
      updatedAt: now,
    };
    const nextAssets = [...assetsFrom(settings).filter((item) => item.id !== asset.id), asset].slice(-4);
    await supabase.from("video_projects").update({
      settings: { ...settings, mediaAnalysisAssets: nextAssets, geminiMediaUpdatedAt: now },
      updated_at: now,
    }).eq("id", id);

    const callbackUrl = `${new URL(request.url).origin}/api/creative-studio-pro/projects/${id}/media-analysis/callback`;
    const response = await fetch(`${workerUrl}/extract-frames`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        videoUrl: url,
        rightsStatus: "owned",
        sampleCount: 12,
        candidateId: asset.id,
        jobId: asset.id,
        callbackUrl,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(result.message || "영상 Worker가 소재 분석 요청을 거부했습니다."));

    const queuedAssets = nextAssets.map((item) => item.id === asset.id ? { ...item, status: "extracting" as const, updatedAt: new Date().toISOString() } : item);
    await supabase.from("video_projects").update({ settings: { ...settings, mediaAnalysisAssets: queuedAssets }, updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ success: true, asset: queuedAssets.find((item) => item.id === asset.id), workerJobId: result.jobId || null });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Gemini 소재 분석 시작 실패" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { assetId?: string; cuts?: GeminiSelectedCut[] };
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings,duration_seconds").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    const assets = assetsFrom(settings);
    const asset = assets.find((item) => item.id === String(body.assetId || ""));
    if (!asset || !asset.analysis) return NextResponse.json({ success: false, message: "완료된 Gemini 분석 소재를 찾지 못했습니다." }, { status: 404 });
    const sourceDuration = Math.max(1, Number(asset.durationSeconds) || 1);
    const target = Math.max(15, Math.min(30, Number(project.duration_seconds) || 20));
    const cuts = normalizeCuts(Array.isArray(body.cuts) ? body.cuts : asset.analysis.recommendedCuts, sourceDuration, target);
    if (!cuts.length) return NextResponse.json({ success: false, message: "최종 영상에 사용할 컷이 없습니다." }, { status: 400 });
    const updatedAsset: Asset = { ...asset, analysis: { ...asset.analysis, recommendedCuts: cuts }, updatedAt: new Date().toISOString() };
    const nextAssets = assets.map((item) => item.id === asset.id ? updatedAsset : item);
    const plan = mixPlan(updatedAsset, cuts, target);
    const now = new Date().toISOString();
    await supabase.from("video_projects").update({
      settings: {
        ...settings,
        mediaAnalysisAssets: nextAssets,
        sourceMixPlan: plan,
        mixStrategy: "licensed-only",
        sourceAudioMode: "mute-korean-tts",
        subtitleCleanupMode: "keep-licensed",
        geminiSelectedAssetId: asset.id,
        geminiMediaUpdatedAt: now,
      },
      render_approved: false,
      render_approved_at: null,
      updated_at: now,
    }).eq("id", id);
    return NextResponse.json({ success: true, asset: updatedAsset, sourceMixPlan: plan, message: "Gemini 추천 컷을 최종 편집 타임라인에 저장했습니다." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Gemini 컷 저장 실패" }, { status: 500 });
  }
}
