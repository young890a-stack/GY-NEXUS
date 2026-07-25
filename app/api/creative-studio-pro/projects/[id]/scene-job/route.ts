import { NextResponse } from "next/server";
import { send } from "@vercel/queue";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  jobProgress,
  objectValue,
  SCENE_JOB_KIND,
  SCENE_QUEUE_TOPIC,
  type SceneQueueMessage,
} from "@/lib/creative-studio-pro/scene-job";

export const runtime = "nodejs";

async function latestProjectJob(projectId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("automation_jobs")
    .select("*")
    .contains("config", { kind: SCENE_JOB_KIND, projectId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

async function enqueue(jobId: string, projectId: string, iteration: number) {
  return send<SceneQueueMessage>(
    SCENE_QUEUE_TOPIC,
    { jobId, projectId, iteration },
    {
      idempotencyKey: `${jobId}:step:${iteration}`,
      retentionSeconds: 604800,
    },
  );
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const job = await latestProjectJob(id);
    return NextResponse.json({
      success: true,
      jobId: job ? String(job.id) : "",
      job: job ? jobProgress(job) : null,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "장면 작업 조회에 실패했습니다.",
    }, { status: 500 });
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = createAdminClient();
  try {
    const existing = await latestProjectJob(id);
    if (existing && ["queued", "processing", "retry"].includes(String(existing.status))) {
      return NextResponse.json({
        success: true,
        jobId: String(existing.id),
        job: jobProgress(existing),
        alreadyRunning: true,
      });
    }

    const now = new Date().toISOString();
    const initialResult = {
      progress: 0,
      approvedScenes: 0,
      totalScenes: 0,
      iteration: 0,
      message: "Dream Y 명장 제작 대기열에 등록했습니다.",
      notificationUnread: false,
    };
    const { data: job, error } = await supabase
      .from("automation_jobs")
      .insert({
        status: "queued",
        current_step: "queued",
        config: {
          kind: SCENE_JOB_KIND,
          projectId: id,
          sceneGenerationMode: "quality",
        },
        result_data: initialResult,
        attempts: 0,
        max_attempts: 8,
        scheduled_at: now,
      })
      .select("*")
      .single();
    if (error || !job) throw error || new Error("장면 작업을 저장하지 못했습니다.");

    try {
      const queued = await enqueue(String(job.id), id, 0);
      const resultData = {
        ...initialResult,
        queueMessageId: String(queued.messageId || ""),
      };
      await supabase
        .from("automation_jobs")
        .update({ result_data: resultData, updated_at: new Date().toISOString() })
        .eq("id", job.id);
      return NextResponse.json({
        success: true,
        jobId: String(job.id),
        job: jobProgress({ ...job, result_data: resultData }),
      });
    } catch (queueError) {
      const reason = queueError instanceof Error ? queueError.message : "서버 대기열 연결 실패";
      await supabase.from("automation_jobs").update({
        status: "failed",
        current_step: "queue_failed",
        last_error: reason,
        completed_at: new Date().toISOString(),
        result_data: {
          ...initialResult,
          message: reason,
          notificationUnread: true,
        },
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      throw queueError;
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "장면 작업 등록에 실패했습니다.",
    }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = createAdminClient();
  try {
    const body = objectValue(await request.json().catch(() => ({})));
    const action = String(body.action || "");
    const job = await latestProjectJob(id);
    if (!job) {
      return NextResponse.json({ success: false, message: "장면 작업을 찾지 못했습니다." }, { status: 404 });
    }
    const result = objectValue(job.result_data);

    if (action === "read") {
      const nextResult = { ...result, notificationUnread: false };
      const { error } = await supabase.from("automation_jobs")
        .update({ result_data: nextResult, updated_at: new Date().toISOString() })
        .eq("id", job.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "cancel") {
      const { error } = await supabase.from("automation_jobs").update({
        status: "cancelled",
        current_step: "cancelled",
        result_data: {
          ...result,
          message: "장면 제작을 취소했습니다.",
          notificationUnread: true,
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "retry") {
      const iteration = Math.max(0, Number(result.iteration) || 0) + 1;
      const nextResult = {
        ...result,
        iteration,
        message: "실패한 장면부터 자동 복구를 시작합니다.",
        notificationUnread: false,
      };
      const { error } = await supabase.from("automation_jobs").update({
        status: "retry",
        current_step: "retry_queued",
        attempts: 0,
        last_error: null,
        completed_at: null,
        scheduled_at: new Date().toISOString(),
        result_data: nextResult,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      if (error) throw error;
      await enqueue(String(job.id), id, iteration);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "장면 작업 변경에 실패했습니다.",
    }, { status: 500 });
  }
}
