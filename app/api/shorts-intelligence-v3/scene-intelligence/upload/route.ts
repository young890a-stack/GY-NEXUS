import { NextResponse } from "next/server";
import { safeStorageSegment, uploadBuffer } from "@/lib/creative-studio/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVerifiedSceneRights } from "@/lib/shorts-intelligence-v3/gemini-scene-intelligence";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 45 * 1024 * 1024;
const allowed = new Map([["video/mp4", "mp4"], ["video/quicktime", "mov"], ["video/webm", "webm"]]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("video");
    const candidateId = String(form.get("candidateId") || "").trim();
    const rightsStatus = String(form.get("rightsStatus") || "unverified");
    const rightsEvidence = String(form.get("rightsEvidence") || "").trim();
    if (!(file instanceof File) || !candidateId) return NextResponse.json({ success: false, message: "후보와 영상 파일을 선택해주세요." }, { status: 400 });
    if (!isVerifiedSceneRights(rightsStatus)) return NextResponse.json({ success: false, message: "사용 권한이 확인된 영상만 업로드할 수 있습니다." }, { status: 403 });
    if (rightsEvidence.length < 3) return NextResponse.json({ success: false, message: "권리 근거를 입력해주세요." }, { status: 400 });
    const extension = allowed.get(file.type);
    if (!extension) return NextResponse.json({ success: false, message: "MP4, MOV, WEBM 영상만 사용할 수 있습니다." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ success: false, message: "직접 업로드 영상은 45MB 이하여야 합니다. 큰 파일은 Render Worker 직접 주소 저장을 사용해주세요." }, { status: 400 });
    const supabase = createAdminClient();
    const { data: candidate, error } = await supabase.from("china_video_candidates").select("id,run_id,title").eq("id", candidateId).single();
    if (error || !candidate) throw error || new Error("후보를 찾지 못했습니다.");
    const date = new Date().toISOString().slice(0, 10);
    const safeName = safeStorageSegment(file.name.replace(/\.[^.]+$/, ""), "v3-scene-source");
    const path = `references/${date}/${Date.now()}-${safeName}-${candidateId.slice(0, 8)}.${extension}`;
    const videoUrl = await uploadBuffer({ buffer: Buffer.from(await file.arrayBuffer()), path, contentType: file.type });
    const evidence = { note: rightsEvidence.slice(0, 1000), uploadedAt: new Date().toISOString(), originalName: file.name };
    const { data: job, error: jobError } = await supabase.from("china_scene_analysis_jobs_v3").upsert({
      run_id: candidate.run_id,
      candidate_id: candidateId,
      status: "frames_ready",
      source_mode: "uploaded",
      source_video_url: videoUrl,
      source_video_mime: file.type,
      source_video_bytes: file.size,
      rights_status: rightsStatus,
      rights_evidence: evidence,
      updated_at: new Date().toISOString(),
    }, { onConflict: "candidate_id" }).select("*").single();
    if (jobError || !job) throw jobError || new Error("장면 작업 저장 실패");
    await supabase.from("china_video_candidates").update({
      source_video_url: videoUrl,
      source_video_mime: file.type,
      source_video_bytes: file.size,
      rights_status: rightsStatus,
      rights_evidence: evidence,
      rights_verified_at: new Date().toISOString(),
      scene_analysis_status: "frames_ready",
    }).eq("id", candidateId);
    const workerUrl = process.env.VIDEO_WORKER_URL?.replace(/\/$/, "");
    const secret = process.env.VIDEO_WORKER_SECRET;
    if (workerUrl && secret) {
      const origin = new URL(request.url).origin;
      await supabase.from("china_scene_analysis_jobs_v3").update({ status: "staging", updated_at: new Date().toISOString() }).eq("id", job.id);
      const workerResponse = await fetch(`${workerUrl}/extract-frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({
          jobId: job.id,
          candidateId,
          videoUrl,
          rightsStatus,
          sampleCount: 12,
          callbackUrl: `${origin}/api/shorts-intelligence-v3/scene-intelligence/frames-callback`,
        }),
      });
      const workerResult = await workerResponse.json().catch(() => ({}));
      if (!workerResponse.ok) throw new Error(workerResult.message || "업로드 영상의 프레임 추출 요청에 실패했습니다.");
      await supabase.from("china_scene_analysis_jobs_v3").update({ worker_job_id: workerResult.jobId || null }).eq("id", job.id);
      return NextResponse.json({ success: true, job, videoUrl, queued: true, message: "영상 업로드 완료. Render Worker가 대표 프레임 12장을 추출하고 있습니다." });
    }
    return NextResponse.json({ success: true, job, videoUrl, queued: false, message: "영상 업로드 완료. Gemini 영상 분석은 가능하지만 프레임 추출에는 Render Worker 연결이 필요합니다." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "영상 업로드 실패" }, { status: 500 });
  }
}
