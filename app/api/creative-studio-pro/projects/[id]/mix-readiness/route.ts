import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateMixReadiness } from "@/lib/creative-studio-pro/mix-readiness";

export const runtime = "nodejs";

async function workerReachable(workerUrl: string) {
  if (!workerUrl) return false;
  try {
    const response = await fetch(`${workerUrl}/health`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const [{ data: project, error }, { data: scenes, error: sceneError }, { data: jobs, error: jobError }] = await Promise.all([
      supabase.from("video_projects").select("*").eq("id", id).single(),
      supabase.from("video_scenes").select("status,video_url,quality_status").eq("project_id", id).order("scene_number"),
      supabase.from("video_render_jobs").select("status,worker_job_id,output_url,error_message,created_at,completed_at").eq("project_id", id).order("created_at", { ascending: false }).limit(1),
    ]);
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    if (sceneError) throw sceneError;
    if (jobError) throw jobError;
    const workerUrl = String(process.env.VIDEO_WORKER_URL || "").replace(/\/$/, "");
    const renderJob = jobs?.[0] || null;
    const readiness = evaluateMixReadiness({
      project: project as Record<string, unknown>,
      scenes: (scenes || []) as Array<Record<string, unknown>>,
      workerConfigured: Boolean(workerUrl && process.env.VIDEO_WORKER_SECRET),
      workerReachable: await workerReachable(workerUrl),
      renderJob: renderJob as Record<string, unknown> | null,
    });
    return NextResponse.json({ success: true, readiness, renderJob });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "짜집기 실행 조건 확인 실패" }, { status: 500 });
  }
}
