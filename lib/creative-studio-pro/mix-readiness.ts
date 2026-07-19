import { normalizeMediaReferences } from "@/lib/creative-studio-pro/integration";

type Blocker = { code: string; message: string; action: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function evaluateMixReadiness(input: {
  project: Record<string, unknown>;
  scenes: Array<Record<string, unknown>>;
  workerConfigured: boolean;
  workerReachable: boolean;
  renderJob?: Record<string, unknown> | null;
}) {
  const settings = record(input.project.settings);
  const plan = record(settings.sourceMixPlan);
  const cuts = Array.isArray(plan.cuts)
    ? plan.cuts.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
  const usableReferences = normalizeMediaReferences(settings.mediaReferences)
    .filter((item) => item.assetKind === "video-file" && item.useInFinal && item.rightsStatus !== "unverified");
  const usableMap = new Map(usableReferences.map((item) => [item.id, item]));
  const licensedCuts = cuts.filter((cut) => cut.decision === "use-licensed");
  const invalidLicensedCuts = licensedCuts.filter((cut) => !usableMap.has(String(cut.referenceId || "")));
  const licensedCutCount = licensedCuts.length - invalidLicensedCuts.length;
  const generatedCutCount = cuts.length - licensedCutCount;
  const readyGeneratedSceneCount = input.scenes.filter((scene) => scene.status === "completed" && String(scene.video_url || "")).length;
  const mode = !cuts.length
    ? "unplanned" as const
    : licensedCutCount === cuts.length
      ? "licensed-direct" as const
      : licensedCutCount > 0
        ? "hybrid" as const
        : "generated" as const;
  const blockers: Blocker[] = [];

  if (!cuts.length) blockers.push({ code: "source-mix", message: "실제 타임라인 컷 설계가 없습니다.", action: "소스를 선택하고 ‘AI 짜집기 설계’를 실행하세요." });
  if (invalidLicensedCuts.length) blockers.push({ code: "licensed-files", message: `허가 원본 ${invalidLicensedCuts.length}컷의 실제 영상 파일을 찾지 못했습니다.`, action: "페이지 링크가 아닌 MP4/MOV 파일을 올리고 권리 상태·최종 사용을 체크한 뒤 믹스를 다시 설계하세요." });
  if (licensedCutCount > 0 && settings.subtitleCleanupMode === "recreate-clean") blockers.push({ code: "edit-mode", message: "현재 ‘AI 새 장면 재제작’ 설정은 허가 원본 컷을 사용하지 않습니다.", action: "허가 영상 하단 안전 크롭 또는 원문 유지로 바꾸고 믹스를 다시 설계하세요." });
  if (generatedCutCount > 0 && readyGeneratedSceneCount === 0) blockers.push({ code: "generated-scenes", message: `새로 제작할 컷이 ${generatedCutCount}개지만 완성된 장면 영상이 없습니다.`, action: "전체 이미지 검수 → Runway 비용 승인 → 남은 영상 모두 생성을 진행하세요." });
  if (generatedCutCount > 0 && !input.project.render_approved) blockers.push({ code: "runway-approval", message: "새 AI 장면을 최종본에 사용할 승인이 필요합니다.", action: "이미지 품질검수 후 Runway 비용 승인을 눌러주세요." });
  if (cuts.length > 0 && generatedCutCount === 0 && !input.project.render_approved) blockers.push({ code: "direct-approval", message: "허가 영상 직접 짜집기 최종 확인이 필요합니다.", action: "실제 짜집기 실행 버튼을 누르면 비용 없이 자동 승인됩니다." });
  if (!settings.contentApprovedAt) blockers.push({ code: "content-approval", message: "한국어 훅·대본 품질 승인이 필요합니다.", action: "훅 3개 중 하나를 고르고 ‘선택한 훅으로 승인’을 누르세요." });
  if (settings.sourceAudioMode === "mute-korean-tts" && !settings.voiceAudioUrl) blockers.push({ code: "voice", message: "한국어 AI 음성이 아직 없습니다.", action: "실제 짜집기 실행 시 승인된 대본으로 자동 생성합니다." });
  if (!input.workerConfigured) blockers.push({ code: "worker-config", message: "VIDEO_WORKER_URL이 연결되지 않았습니다.", action: "Vercel과 영상 Worker에 URL·동일한 VIDEO_WORKER_SECRET을 설정하세요." });
  else if (!input.workerReachable) blockers.push({ code: "worker-offline", message: "영상 Worker가 응답하지 않습니다.", action: "Worker 배포 상태와 /health 주소를 확인하세요." });
  if (["queued", "rendering"].includes(String(input.renderJob?.status || ""))) blockers.push({ code: "render-active", message: "이미 실제 짜집기 작업이 진행 중입니다.", action: "화면이 4초마다 자동 갱신되므로 완료될 때까지 기다리세요." });

  return {
    ready: blockers.length === 0,
    mode,
    licensedCutCount,
    generatedCutCount,
    readyGeneratedSceneCount,
    usableLicensedAssetCount: usableReferences.length,
    worker: { configured: input.workerConfigured, reachable: input.workerReachable },
    blockers,
  };
}
