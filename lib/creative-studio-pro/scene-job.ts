export const SCENE_JOB_KIND = "creative-scene-master";
export const SCENE_QUEUE_TOPIC = "gy-scene-master";

export type SceneJobStatus =
  | "queued"
  | "processing"
  | "retry"
  | "completed"
  | "failed"
  | "cancelled";

export type SceneJobProgress = {
  projectId: string;
  status: SceneJobStatus;
  currentStep: string;
  progress: number;
  approvedScenes: number;
  totalScenes: number;
  attempts: number;
  maxAttempts: number;
  message: string;
  lastError: string;
  notificationUnread: boolean;
  updatedAt: string;
};

export type SceneQueueMessage = {
  jobId: string;
  projectId: string;
  iteration: number;
  sceneGenerationMode?: "fast" | "balanced" | "quality";
};

export function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function jobProgress(job: Record<string, unknown>): SceneJobProgress {
  const config = objectValue(job.config);
  const result = objectValue(job.result_data);
  return {
    projectId: String(config.projectId || ""),
    status: String(job.status || "queued") as SceneJobStatus,
    currentStep: String(job.current_step || "queued"),
    progress: Math.max(0, Math.min(100, Number(result.progress) || 0)),
    approvedScenes: Math.max(0, Number(result.approvedScenes) || 0),
    totalScenes: Math.max(0, Number(result.totalScenes) || 0),
    attempts: Math.max(0, Number(job.attempts) || 0),
    maxAttempts: Math.max(1, Number(job.max_attempts) || 8),
    message: String(result.message || "장면 제작을 준비하고 있습니다."),
    lastError: String(job.last_error || ""),
    notificationUnread: result.notificationUnread === true,
    updatedAt: String(job.updated_at || ""),
  };
}
