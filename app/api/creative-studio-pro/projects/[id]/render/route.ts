import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalUseRightsViolations, normalizeMediaReferences } from "@/lib/creative-studio-pro/integration";
export const runtime = "nodejs";
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const { data: scenes, error: sceneError } = await supabase.from("video_scenes").select("*").eq("project_id", id).order("scene_number");
    if (sceneError) throw sceneError;
    const settings = project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? project.settings as Record<string, unknown>
      : {};
    const rightsViolations = finalUseRightsViolations(settings.mediaReferences);
    if (rightsViolations.length > 0) return NextResponse.json({ success: false, message: `권리 미확인 자료 또는 페이지 링크가 최종 원본 컷으로 선택되어 있습니다: ${rightsViolations.join(", ")}` }, { status: 400 });
    if (!settings.contentApprovedAt) return NextResponse.json({ success: false, message: "대표 콘텐츠 품질 승인 후 최종 MP4를 만들 수 있습니다." }, { status: 400 });
    const licensedFinalAssets = normalizeMediaReferences(settings.mediaReferences)
      .filter((item) => item.useInFinal && item.rightsStatus !== "unverified");
    const licensedMap = new Map(licensedFinalAssets.map((item) => [item.id, item]));
    const sourceMix = settings.sourceMixPlan && typeof settings.sourceMixPlan === "object" && !Array.isArray(settings.sourceMixPlan)
      ? settings.sourceMixPlan as Record<string, unknown>
      : {};
    const cuts = Array.isArray(sourceMix.cuts) ? sourceMix.cuts as Array<Record<string, unknown>> : [];
    if (!cuts.length) return NextResponse.json({ success: false, message: "먼저 AI 짜집기 타임라인을 설계해주세요." }, { status: 400 });
    const missingLicensed = cuts.filter((cut) => cut.decision === "use-licensed" && !licensedMap.has(String(cut.referenceId || "")));
    if (missingLicensed.length) return NextResponse.json({ success: false, message: `허가 원본 ${missingLicensed.length}컷의 실제 영상 파일이 없습니다. 소스함에서 파일·권리·최종 사용을 확인하고 믹스를 다시 설계해주세요.` }, { status: 400 });
    const generatedCuts = cuts.filter((cut) => cut.decision !== "use-licensed");
    const readyScenes = (scenes || []).filter((scene) => scene.status === "completed" && scene.video_url);
    if (generatedCuts.length > 0 && !project.render_approved) return NextResponse.json({ success: false, message: "새 AI 장면이 포함되어 있습니다. 품질검수 후 Runway 비용 승인을 해주세요." }, { status: 400 });
    if (generatedCuts.length > 0 && readyScenes.length === 0) return NextResponse.json({ success: false, message: `새로 제작할 ${generatedCuts.length}컷에 사용할 완성 장면 영상이 없습니다. Runway 장면을 먼저 생성해주세요.` }, { status: 400 });
    if (generatedCuts.length === 0 && !project.render_approved) return NextResponse.json({ success: false, message: "허가 영상 직접 짜집기 최종 확인이 필요합니다. 실제 짜집기 실행 버튼을 다시 눌러주세요." }, { status: 400 });
    if (settings.sourceAudioMode === "mute-korean-tts" && !settings.voiceAudioUrl) return NextResponse.json({ success: false, message: "한국어 AI 음성을 먼저 생성해주세요." }, { status: 400 });
    const workerProject = {
      ...project,
      settings: {
        ...settings,
        mediaReferences: licensedFinalAssets,
        licensedFinalAssets,
      },
    };

    const workerUrl = process.env.VIDEO_WORKER_URL?.replace(/\/$/, "");
    if (!workerUrl || !process.env.VIDEO_WORKER_SECRET) {
      await supabase.from("video_projects").update({ status: "worker_required", updated_at: new Date().toISOString() }).eq("id", id);
      return NextResponse.json({ success: false, workerRequired: true, message: "최종 MP4 합성에는 FFmpeg 영상 Worker가 필요합니다. VIDEO_WORKER_URL과 동일한 VIDEO_WORKER_SECRET을 연결해주세요." }, { status: 409 });
    }
    const { data: activeJobs } = await supabase.from("video_render_jobs").select("id,status").eq("project_id", id).in("status", ["queued", "rendering"]).limit(1);
    if (activeJobs?.length) return NextResponse.json({ success: false, message: "이미 실제 짜집기 작업이 진행 중입니다. 화면에서 상태가 자동 갱신됩니다." }, { status: 409 });
    await supabase.from("video_projects").update({ status: "rendering", updated_at: new Date().toISOString() }).eq("id", id);
    const response = await fetch(`${workerUrl}/render`, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.VIDEO_WORKER_SECRET ? { Authorization: `Bearer ${process.env.VIDEO_WORKER_SECRET}` } : {}) }, body: JSON.stringify({ project: workerProject, scenes, callbackUrl: `${new URL(_.url).origin}/api/creative-studio-pro/projects/${id}/render-callback` }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "영상 Worker가 렌더링 요청을 거부했습니다.");
    await supabase.from("video_render_jobs").insert({ project_id: id, worker_job_id: result.jobId || null, status: "queued", request_payload: { project: workerProject, scenes } });
    return NextResponse.json({ success: true, message: "최종 영상 렌더링을 시작했습니다.", jobId: result.jobId || null });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "렌더링 요청 실패" }, { status: 500 }); }
}
