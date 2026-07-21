import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  analyzeFramesWithGemini,
  analyzeVideoWithGemini,
  getGeminiSceneApiKey,
  getGeminiSceneModel,
  isVerifiedSceneRights,
  manualScenePrompt,
  validateSceneIntelligence,
  type SceneIntelligenceResult,
} from "@/lib/shorts-intelligence-v3/gemini-scene-intelligence";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const MAX_FRAME_BYTES = 8 * 1024 * 1024;

function privateAddress(address: string) {
  if (isIP(address) === 4) {
    const p = address.split(".").map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
  }
  const value = address.toLowerCase();
  return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}

async function safeUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("HTTPS 미디어 주소만 허용됩니다.");
  const addresses = await lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some((item) => privateAddress(item.address))) throw new Error("내부 네트워크 주소는 사용할 수 없습니다.");
  return parsed;
}

async function fetchBuffer(url: string, maxBytes: number, expected: "video" | "image") {
  const parsed = await safeUrl(url);
  const response = await fetch(parsed, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`분석 소재 다운로드 실패: ${response.status}`);
  const mimeType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!mimeType.startsWith(`${expected}/`)) throw new Error(`${expected === "video" ? "영상" : "이미지"} 파일 주소가 아닙니다.`);
  const announced = Number(response.headers.get("content-length") || 0);
  if (announced && announced > maxBytes) throw new Error(`분석 파일이 ${Math.round(maxBytes / 1024 / 1024)}MB를 초과합니다.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) throw new Error(`분석 파일이 ${Math.round(maxBytes / 1024 / 1024)}MB를 초과합니다.`);
  return { buffer, mimeType };
}

function analysisScore(result: SceneIntelligenceResult) {
  return Math.max(0, Math.min(100, Math.round(
    result.productMatchScore * .28 + result.commercialPotentialScore * .34 + result.structureClarityScore * .23 + (100 - result.originalityRiskScore) * .15,
  )));
}

async function persistResult(job: Record<string, unknown>, candidate: Record<string, unknown>, result: SceneIntelligenceResult, provider: string) {
  const supabase = createAdminClient();
  const jobId = String(job.id);
  const candidateId = String(candidate.id);
  const frameUrls = Array.isArray(job.frame_urls) ? job.frame_urls.map(String) : [];
  const frameTimestamps = Array.isArray(job.frame_timestamps) ? job.frame_timestamps.map(Number) : [];
  await supabase.from("china_scene_segments_v3").delete().eq("job_id", jobId);
  const rows = result.scenes.map((scene) => {
    let nearestFrame = "";
    let distance = Number.POSITIVE_INFINITY;
    frameTimestamps.forEach((timestamp, index) => {
      const next = Math.abs(timestamp - scene.representativeTimestamp);
      if (next < distance) { distance = next; nearestFrame = frameUrls[index] || ""; }
    });
    return {
      job_id: jobId,
      candidate_id: candidateId,
      scene_index: scene.sceneIndex,
      start_second: scene.startSecond,
      end_second: scene.endSecond,
      role: scene.role,
      visual_description: scene.visualDescription,
      camera_direction: scene.cameraDirection,
      on_screen_text: scene.onScreenText,
      audio_narration: scene.audioNarration,
      emotion: scene.emotion,
      product_visibility_score: scene.productVisibilityScore,
      hook_score: scene.hookScore,
      proof_score: scene.proofScore,
      copyright_risk_score: scene.copyrightRiskScore,
      reusable_pattern: scene.reusablePattern,
      recreate_direction: scene.recreateDirection,
      evidence: scene.evidence,
      representative_timestamp: scene.representativeTimestamp,
      representative_frame_url: nearestFrame || null,
    };
  });
  const { error: segmentError } = await supabase.from("china_scene_segments_v3").insert(rows);
  if (segmentError) throw segmentError;
  const score = analysisScore(result);
  const now = new Date().toISOString();
  await supabase.from("china_scene_analysis_jobs_v3").update({
    status: "completed",
    provider,
    model: provider === "gemini-pro-manual" ? "Gemini Pro app" : getGeminiSceneModel(),
    analysis_score: score,
    analysis_result: result,
    error_message: null,
    completed_at: now,
    updated_at: now,
  }).eq("id", jobId);
  await supabase.from("china_video_candidates").update({
    scene_analysis_status: "completed",
    scene_analysis_score: score,
    scene_analysis_summary: result.summary,
    scene_analysis: result,
  }).eq("id", candidateId);
  return score;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const candidateId = String(body.candidateId || "").trim();
    const mode = String(body.mode || "auto");
    if (!candidateId) return NextResponse.json({ success: false, message: "candidateId가 필요합니다." }, { status: 400 });
    const supabase = createAdminClient();
    const [{ data: candidate, error: candidateError }, { data: job, error: jobError }] = await Promise.all([
      supabase.from("china_video_candidates").select("id,run_id,title,platform,rights_status,source_video_url,source_video_mime,source_video_bytes,source_duration_seconds").eq("id", candidateId).single(),
      supabase.from("china_scene_analysis_jobs_v3").select("*").eq("candidate_id", candidateId).single(),
    ]);
    if (candidateError || !candidate) throw candidateError || new Error("후보를 찾지 못했습니다.");
    if (jobError || !job) throw jobError || new Error("상위 30개 선별을 먼저 실행해주세요.");
    if (!isVerifiedSceneRights(job.rights_status)) return NextResponse.json({ success: false, message: "권리 확인된 영상만 정밀분석할 수 있습니다." }, { status: 403 });
    const { data: run } = await supabase.from("china_discovery_runs").select("query").eq("id", candidate.run_id).single();
    const duration = Math.max(1, Number(job.duration_seconds || candidate.source_duration_seconds) || 60);
    const promptInput = { productQuery: run?.query || candidate.title || "상품", candidateTitle: candidate.title || "제목 없음", platform: candidate.platform || "unknown", durationSeconds: duration, frameTimestamps: Array.isArray(job.frame_timestamps) ? job.frame_timestamps.map(Number) : [] };
    if (mode === "manual-export") {
      await supabase.from("china_scene_analysis_jobs_v3").update({ status: "manual_ready", source_mode: "gemini-pro-manual", updated_at: new Date().toISOString() }).eq("id", job.id);
      return NextResponse.json({ success: true, mode: "gemini-pro-manual", prompt: manualScenePrompt(promptInput), videoUrl: job.source_video_url, frameUrls: job.frame_urls || [] });
    }
    if (mode === "manual-import") {
      const result = validateSceneIntelligence(body.result, duration);
      const score = await persistResult(job, candidate, result, "gemini-pro-manual");
      return NextResponse.json({ success: true, score, result });
    }
    if (!getGeminiSceneApiKey()) return NextResponse.json({ success: false, code: "GEMINI_API_KEY_REQUIRED", message: "Gemini API 키가 없습니다. Gemini Pro 직접 분석 모드를 사용해주세요.", prompt: manualScenePrompt(promptInput) }, { status: 409 });
    if (!job.source_video_url) return NextResponse.json({ success: false, message: "권리 확인된 영상 파일을 먼저 저장하거나 업로드해주세요." }, { status: 400 });
    await supabase.from("china_scene_analysis_jobs_v3").update({ status: "analyzing", attempts: Number(job.attempts || 0) + 1, error_message: null, updated_at: new Date().toISOString() }).eq("id", job.id);
    await supabase.from("china_video_candidates").update({ scene_analysis_status: "analyzing" }).eq("id", candidateId);
    let result: SceneIntelligenceResult;
    const sourceBytes = Number(job.source_video_bytes || candidate.source_video_bytes) || 0;
    if (!sourceBytes || sourceBytes <= MAX_VIDEO_BYTES) {
      try {
        const video = await fetchBuffer(String(job.source_video_url), MAX_VIDEO_BYTES, "video");
        result = await analyzeVideoWithGemini({ video: video.buffer, mimeType: video.mimeType, productQuery: promptInput.productQuery, candidateTitle: promptInput.candidateTitle, platform: promptInput.platform, durationSeconds: duration });
      } catch (videoError) {
        const urls = Array.isArray(job.frame_urls) ? job.frame_urls.map(String).filter(Boolean).slice(0, 12) : [];
        const timestamps = Array.isArray(job.frame_timestamps) ? job.frame_timestamps.map(Number) : [];
        if (!urls.length) throw videoError;
        const frames = await Promise.all(urls.map(async (url: string, index: number) => {
          const image = await fetchBuffer(url, MAX_FRAME_BYTES, "image");
          return { data: image.buffer, mimeType: image.mimeType, timestamp: Number(timestamps[index]) || index };
        }));
        result = await analyzeFramesWithGemini({ frames, productQuery: promptInput.productQuery, candidateTitle: promptInput.candidateTitle, platform: promptInput.platform, durationSeconds: duration });
      }
    } else {
      const urls = Array.isArray(job.frame_urls) ? job.frame_urls.map(String).filter(Boolean).slice(0, 12) : [];
      const timestamps = Array.isArray(job.frame_timestamps) ? job.frame_timestamps.map(Number) : [];
      if (!urls.length) throw new Error("60MB 초과 영상은 Render Worker가 만든 대표 프레임이 필요합니다.");
      const frames = await Promise.all(urls.map(async (url: string, index: number) => {
        const image = await fetchBuffer(url, MAX_FRAME_BYTES, "image");
        return { data: image.buffer, mimeType: image.mimeType, timestamp: Number(timestamps[index]) || index };
      }));
      result = await analyzeFramesWithGemini({ frames, productQuery: promptInput.productQuery, candidateTitle: promptInput.candidateTitle, platform: promptInput.platform, durationSeconds: duration });
    }
    const score = await persistResult(job, candidate, result, "gemini-api");
    return NextResponse.json({ success: true, score, result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Gemini 장면 정밀분석에 실패했습니다." }, { status: 500 });
  }
}
