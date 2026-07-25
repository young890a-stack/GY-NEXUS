import { handleCallback, send } from "@vercel/queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { POST as prepareNextScene } from "@/app/api/creative-studio-pro/projects/[id]/prepare-next/route";
import {
  objectValue,
  SCENE_QUEUE_TOPIC,
  type SceneQueueMessage,
} from "@/lib/creative-studio-pro/scene-job";

export const runtime = "nodejs";
export const maxDuration = 300;

type SceneRow = {
  id: string;
  scene_number?: number | null;
  quality_status?: string | null;
};

function sceneStats(scenes: SceneRow[]) {
  const totalScenes = scenes.length;
  const approvedScenes = scenes.filter((scene) => scene.quality_status === "approved").length;
  return {
    totalScenes,
    approvedScenes,
    progress: totalScenes ? Math.round((approvedScenes / totalScenes) * 100) : 0,
  };
}

async function updateJob(jobId: string, values: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("automation_jobs").update({
    ...values,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
  if (error) throw error;
}

type SceneGenerationMode = "fast" | "balanced" | "quality";

function sceneMode(value: unknown): SceneGenerationMode {
  return value === "fast" || value === "balanced" ? value : "quality";
}

async function runScene(projectId: string, sceneId: string, sceneGenerationMode: SceneGenerationMode) {
  const response = await prepareNextScene(
    new Request("https://queue.internal/prepare-next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneId, sceneGenerationMode }),
    }),
    { params: Promise.resolve({ id: projectId }) },
  );
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok || payload.success === false) {
    throw new Error(String(payload.message || `장면 생성 요청 실패 (${response.status})`));
  }
  return payload;
}

export const POST = handleCallback<SceneQueueMessage>(async (message) => {
  const supabase = createAdminClient();
  const { jobId, projectId } = message;
  const { data: job, error: jobError } = await supabase
    .from("automation_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job || ["completed", "failed", "cancelled"].includes(String(job.status))) return;

  const previousResult = objectValue(job.result_data);
  const jobConfig = objectValue(job.config);
  const sceneGenerationMode = sceneMode(message.sceneGenerationMode || jobConfig.sceneGenerationMode);
  const iteration = Math.max(Number(message.iteration) || 0, Number(previousResult.iteration) || 0);
  await updateJob(jobId, {
    status: "processing",
    current_step: "checking_scenes",
    started_at: job.started_at || new Date().toISOString(),
    last_error: null,
    result_data: {
      ...previousResult,
      iteration,
      message: "저장된 장면 상태를 확인하고 있습니다.",
      notificationUnread: false,
    },
  });

  try {
    const [{ data: project, error: projectError }, { data: initialScenes, error: sceneError }] = await Promise.all([
      supabase.from("video_projects").select("settings").eq("id", projectId).single(),
      supabase.from("video_scenes").select("id,scene_number,quality_status").eq("project_id", projectId).order("scene_number"),
    ]);
    if (projectError) throw projectError;
    if (sceneError) throw sceneError;
    const scenes = (initialScenes || []) as SceneRow[];
    if (!scenes.length) throw new Error("제작할 장면이 없습니다. 프로젝트를 먼저 생성해 주세요.");

    const held = scenes.find((scene) => scene.quality_status === "hold");
    if (held) {
      const stats = sceneStats(scenes);
      await updateJob(jobId, {
        status: "failed",
        current_step: "quality_hold",
        completed_at: new Date().toISOString(),
        last_error: `장면 ${held.scene_number || ""}이 상품 사실 검수에서 보류되었습니다.`,
        result_data: {
          ...previousResult,
          ...stats,
          iteration,
          message: `장면 ${held.scene_number || ""}의 상품 정보나 사진을 보완해 주세요.`,
          notificationUnread: true,
        },
      });
      return;
    }

    if (scenes.every((scene) => scene.quality_status === "approved")) {
      const stats = sceneStats(scenes);
      await updateJob(jobId, {
        status: "completed",
        current_step: "completed",
        completed_at: new Date().toISOString(),
        result_data: {
          ...previousResult,
          ...stats,
          progress: 100,
          iteration,
          message: "모든 장면이 Dream Y 명장 검수를 통과했습니다.",
          notificationUnread: true,
        },
      });
      return;
    }

    const finalizing = scenes
      .filter((scene) => scene.quality_status === "finalizing")
      .sort((left, right) => Number(left.scene_number || 0) - Number(right.scene_number || 0));
    const drafts = scenes
      .filter((scene) => !["approved", "finalizing"].includes(String(scene.quality_status || "")))
      .sort((left, right) => Number(left.scene_number || 0) - Number(right.scene_number || 0));
    const settings = objectValue(project.settings);
    const visualProfile = objectValue(settings.visualProfile);
    const profileReady = typeof visualProfile.identitySummary === "string";
    const parallelDrafts = sceneGenerationMode === "fast" ? 4 : sceneGenerationMode === "balanced" ? 3 : 2;
    const targets = finalizing.length
      ? finalizing.slice(0, 1)
      : drafts.slice(0, profileReady ? parallelDrafts : 1);
    if (!targets.length) throw new Error("다음 장면을 선택하지 못했습니다.");

    await updateJob(jobId, {
      current_step: finalizing.length ? "continuity_finishing" : "draft_generation",
      result_data: {
        ...previousResult,
        ...sceneStats(scenes),
        iteration,
        message: finalizing.length
          ? `장면 ${targets[0].scene_number || ""}을 고해상도 연속성 마감 중입니다.`
          : `장면 ${targets.map((scene) => scene.scene_number).join(", ")}의 명장 초안을 제작 중입니다.`,
        notificationUnread: false,
      },
    });

    await Promise.all(targets.map((scene) => runScene(projectId, scene.id, sceneGenerationMode)));

    const { data: latestScenes, error: latestError } = await supabase
      .from("video_scenes")
      .select("id,scene_number,quality_status")
      .eq("project_id", projectId)
      .order("scene_number");
    if (latestError) throw latestError;
    const latest = (latestScenes || []) as SceneRow[];
    const stats = sceneStats(latest);
    const { data: currentJob } = await supabase
      .from("automation_jobs")
      .select("status")
      .eq("id", jobId)
      .maybeSingle();
    if (currentJob?.status === "cancelled") return;
    const latestHold = latest.find((scene) => scene.quality_status === "hold");
    if (latestHold) {
      await updateJob(jobId, {
        status: "failed",
        current_step: "quality_hold",
        completed_at: new Date().toISOString(),
        last_error: `장면 ${latestHold.scene_number || ""}이 상품 사실 검수에서 보류되었습니다.`,
        result_data: {
          ...previousResult,
          ...stats,
          iteration,
          message: `장면 ${latestHold.scene_number || ""}의 상품 정보나 사진을 보완해 주세요.`,
          notificationUnread: true,
        },
      });
      return;
    }

    if (stats.totalScenes > 0 && stats.approvedScenes === stats.totalScenes) {
      await updateJob(jobId, {
        status: "completed",
        current_step: "completed",
        completed_at: new Date().toISOString(),
        result_data: {
          ...previousResult,
          ...stats,
          progress: 100,
          iteration,
          message: "모든 장면이 Dream Y 명장 검수를 통과했습니다.",
          notificationUnread: true,
        },
      });
      return;
    }

    const nextIteration = iteration + 1;
    await updateJob(jobId, {
      status: "retry",
      current_step: "next_scene_queued",
      scheduled_at: new Date(Date.now() + 1500).toISOString(),
      result_data: {
        ...previousResult,
        ...stats,
        iteration: nextIteration,
        message: `${stats.approvedScenes}/${stats.totalScenes}개 완료 · 다음 장면을 자동으로 이어갑니다.`,
        notificationUnread: false,
      },
    });
    await send<SceneQueueMessage>(
      SCENE_QUEUE_TOPIC,
      { jobId, projectId, iteration: nextIteration, sceneGenerationMode },
      {
        idempotencyKey: `${jobId}:step:${nextIteration}`,
        retentionSeconds: 604800,
        delaySeconds: sceneGenerationMode === "fast" ? 0 : sceneGenerationMode === "balanced" ? 1 : 2,
      },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "장면 제작 중 알 수 없는 오류";
    const failures = Number(job.attempts || 0) + 1;
    const maxAttempts = Number(job.max_attempts || 8);
    const terminal = failures >= maxAttempts;
    await updateJob(jobId, {
      status: terminal ? "failed" : "retry",
      current_step: terminal ? "failed" : "automatic_retry",
      attempts: failures,
      last_error: reason,
      completed_at: terminal ? new Date().toISOString() : null,
      scheduled_at: terminal ? job.scheduled_at : new Date(Date.now() + 5000).toISOString(),
      result_data: {
        ...previousResult,
        iteration,
        message: terminal
          ? `자동 복구 한도를 초과했습니다: ${reason}`
          : `일시 오류를 감지해 자동 복구 중입니다. (${failures}/${maxAttempts})`,
        notificationUnread: terminal,
      },
    });
    if (!terminal) throw error;
  }
}, {
  visibilityTimeoutSeconds: 300,
  retry: (_error, metadata) => metadata.deliveryCount > 10
    ? { acknowledge: true }
    : { afterSeconds: Math.min(60, 5 * (2 ** Math.max(0, metadata.deliveryCount - 1))) },
});
