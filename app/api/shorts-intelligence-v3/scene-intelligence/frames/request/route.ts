import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVerifiedSceneRights } from "@/lib/shorts-intelligence-v3/gemini-scene-intelligence";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const candidateId = String(body.candidateId || "").trim();
    const sourceUrl = String(body.sourceUrl || "").trim();
    const rightsStatus = String(body.rightsStatus || "unverified");
    const rightsEvidence = String(body.rightsEvidence || "").trim();
    if (!candidateId || !sourceUrl) return NextResponse.json({ success: false, message: "후보와 직접 영상 주소가 필요합니다." }, { status: 400 });
    if (!isVerifiedSceneRights(rightsStatus)) return NextResponse.json({ success: false, message: "직접 촬영·판매자 제공·제휴센터 제공·사용 허가 확인 영상만 자동 저장할 수 있습니다." }, { status: 403 });
    if (rightsEvidence.length < 3) return NextResponse.json({ success: false, message: "권리 근거를 입력해주세요." }, { status: 400 });
    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== "https:") return NextResponse.json({ success: false, message: "HTTPS 직접 영상 주소만 사용할 수 있습니다." }, { status: 400 });
    const workerUrl = process.env.VIDEO_WORKER_URL?.replace(/\/$/, "");
    const secret = process.env.VIDEO_WORKER_SECRET;
    if (!workerUrl || !secret) return NextResponse.json({ success: false, message: "Render 영상 Worker 환경변수를 먼저 연결해주세요." }, { status: 409 });
    const supabase = createAdminClient();
    const { data: candidate, error: candidateError } = await supabase.from("china_video_candidates")
      .select("id,run_id,title,platform").eq("id", candidateId).single();
    if (candidateError || !candidate) throw candidateError || new Error("후보를 찾지 못했습니다.");
    const evidence = { note: rightsEvidence.slice(0, 1000), confirmedAt: new Date().toISOString() };
    const { data: job, error: jobError } = await supabase.from("china_scene_analysis_jobs_v3").upsert({
      run_id: candidate.run_id,
      candidate_id: candidateId,
      status: "staging",
      source_mode: "verified-remote",
      rights_status: rightsStatus,
      rights_evidence: evidence,
      source_video_url: sourceUrl,
      error_message: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "candidate_id" }).select("*").single();
    if (jobError || !job) throw jobError || new Error("장면 작업을 만들지 못했습니다.");
    await supabase.from("china_video_candidates").update({
      rights_status: rightsStatus,
      rights_evidence: evidence,
      rights_verified_at: new Date().toISOString(),
      scene_analysis_status: "staging",
    }).eq("id", candidateId);
    const origin = new URL(request.url).origin;
    const response = await fetch(`${workerUrl}/extract-frames`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        jobId: job.id,
        candidateId,
        videoUrl: sourceUrl,
        rightsStatus,
        sampleCount: Math.min(12, Math.max(6, Math.round(Number(body.sampleCount) || 12))),
        callbackUrl: `${origin}/api/shorts-intelligence-v3/scene-intelligence/frames-callback`,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "영상 Worker가 프레임 추출을 거부했습니다.");
    await supabase.from("china_scene_analysis_jobs_v3").update({ worker_job_id: result.jobId || null, updated_at: new Date().toISOString() }).eq("id", job.id);
    return NextResponse.json({ success: true, queued: true, jobId: job.id, workerJobId: result.jobId || null });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "원본 저장·프레임 추출 요청에 실패했습니다." }, { status: 500 });
  }
}
