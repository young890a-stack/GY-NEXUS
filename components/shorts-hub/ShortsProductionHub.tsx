"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";
import type { ContentFactoryPackage } from "@/lib/content-factory/types";
import styles from "./ShortsProductionHub.module.css";

type Mode = "manual" | "guided" | "auto";
type SourceStrategy = "korean-original" | "china-reference" | "single-photo";
type StepKey = "product" | "strategy" | "assets" | "project" | "scenes" | "voice" | "render" | "publish";
type StepState = "waiting" | "running" | "done" | "error";

type CanvasStep = {
  key: StepKey;
  number: string;
  label: string;
  description: string;
  state: StepState;
  detail: string;
};

type ImportedProduct = {
  name: string;
  description: string;
  imageUrl: string;
  priceText: string;
  platform: string;
  finalUrl: string;
  warning?: string;
};

type CommercePackage = {
  productCode?: string;
  title?: string;
  description?: string;
  disclosure?: string;
  cta?: string;
  platformVersions?: {
    youtube?: {
      title?: string;
      description?: string;
      hashtags?: string[];
    };
  };
};

type ProjectRecord = {
  id: string;
  title: string;
  product_name: string;
  product_description?: string;
  final_video_url?: string | null;
  settings?: {
    commercePackage?: CommercePackage;
  } | null;
};

type ProjectScene = {
  id?: string;
  scene_number?: number;
  start_second?: number;
  end_second?: number;
  role?: string;
  narration?: string;
  subtitle_text?: string;
  status?: string;
  quality_status?: string;
  selected_image_url?: string | null;
  selected_video_url?: string | null;
};

type ProjectResponse = {
  success?: boolean;
  message?: string;
  project?: ProjectRecord;
  scenes?: ProjectScene[];
  renderJob?: {
    status?: string;
    error_message?: string;
  } | null;
};

const initialSteps: CanvasStep[] = [
  { key: "product", number: "01", label: "상품", description: "제휴링크·상품정보", state: "waiting", detail: "" },
  { key: "strategy", number: "02", label: "키워드·대본", description: "훅·대본·SEO", state: "waiting", detail: "" },
  { key: "assets", number: "03", label: "소재", description: "상품 사진 업로드", state: "waiting", detail: "" },
  { key: "project", number: "04", label: "프로젝트", description: "장면·썸네일 기획", state: "waiting", detail: "" },
  { key: "scenes", number: "05", label: "장면", description: "AI 이미지 품질검수", state: "waiting", detail: "" },
  { key: "voice", number: "06", label: "음성·음악", description: "한국어 음성·효과음", state: "waiting", detail: "" },
  { key: "render", number: "07", label: "영상 합성", description: "Runway·최종 MP4", state: "waiting", detail: "" },
  { key: "publish", number: "08", label: "게시", description: "YouTube 비공개 대기", state: "waiting", detail: "" },
];

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "GY-shopping-shorts";
}

function downloadText(fileName: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  let payload: unknown = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (!response.ok || record.success === false) {
    throw new Error(String(record.message || `${response.status} 요청 실패`));
  }
  return payload as T;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function ShortsProductionHub() {
  const [mode, setMode] = useState<Mode>("guided");
  const [sourceStrategy, setSourceStrategy] = useState<SourceStrategy>("korean-original");
  const [activeStep, setActiveStep] = useState<StepKey>("product");
  const [steps, setSteps] = useState<CanvasStep[]>(initialSteps);

  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [priceText, setPriceText] = useState("");
  const [platform, setPlatform] = useState("");

  const [duration, setDuration] = useState<15 | 20 | 25 | 30>(20);
  const [tone, setTone] = useState("친근하고 재미있는 생활 밀착형");
  const [style, setStyle] = useState<"problem-solution" | "ugc-review" | "how-to" | "cinematic-product">("problem-solution");
  const [voicePreset, setVoicePreset] = useState<"marin" | "coral" | "shimmer" | "cedar" | "onyx" | "echo">("marin");
  const [musicMood, setMusicMood] = useState("bright-commerce");
  const [sfxMode, setSfxMode] = useState<"recommended" | "minimal" | "none">("recommended");

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [factoryResult, setFactoryResult] = useState<ContentFactoryPackage | null>(null);
  const [draftVoiceover, setDraftVoiceover] = useState("");

  const [projectId, setProjectId] = useState("");
  const [projectDetail, setProjectDetail] = useState<ProjectRecord | null>(null);
  const [projectScenes, setProjectScenes] = useState<ProjectScene[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState("");
  const [publishQueued, setPublishQueued] = useState(false);

  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("제휴링크 또는 상품정보를 입력해 첫 쇼핑 쇼츠 프로젝트를 시작하세요.");
  const [error, setError] = useState("");

  const completedCount = useMemo(
    () => steps.filter((step) => step.state === "done").length,
    [steps],
  );
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const currentStep = steps.find((step) => step.key === activeStep) || steps[0];
  const nextWaitingStep = steps.find((step) => step.state !== "done");

  function markStep(key: StepKey, state: StepState, detail = "") {
    setSteps((current) => current.map((step) => step.key === key ? { ...step, state, detail } : step));
  }

  function moveTo(key: StepKey) {
    setActiveStep(key);
    setError("");
  }

  async function importAffiliateProduct() {
    if (!affiliateUrl.trim() || busy) return;
    setBusy("product");
    setError("");
    setMessage("제휴링크에서 상품명·이미지·가격을 불러오고 있습니다.");
    markStep("product", "running");

    try {
      const data = await jsonRequest<{ success?: boolean; product?: ImportedProduct }>(
        "/api/revenue-shorts/product-import",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: affiliateUrl.trim() }),
        },
      );

      if (!data.product) throw new Error("상품 정보를 받지 못했습니다.");

      setAffiliateUrl(data.product.finalUrl || affiliateUrl.trim());
      setProductName(data.product.name || "");
      setDescription(data.product.description || "");
      setProductImageUrl(data.product.imageUrl || "");
      setPriceText(data.product.priceText || "");
      setPlatform(data.product.platform || "");
      markStep("product", "done", data.product.name || "상품정보 준비 완료");
      setMessage(data.product.warning || "상품정보를 불러왔습니다. 대본과 키워드를 만들 차례입니다.");
      setActiveStep("strategy");
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "상품정보를 불러오지 못했습니다.";
      setError(reason);
      markStep("product", "error", reason);
    } finally {
      setBusy("");
    }
  }

  async function generateStrategyCore(): Promise<ContentFactoryPackage> {
    if (!productName.trim()) throw new Error("상품명을 먼저 입력해주세요.");

    markStep("strategy", "running");
    setMessage("Dream Y가 한국형 훅·대본·장면표·SEO·썸네일 문구를 만들고 있습니다.");

    const data = await jsonRequest<{ success?: boolean; result?: ContentFactoryPackage }>(
      "/api/content-factory/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: productName.trim(),
          description: description.trim(),
          affiliateUrl: affiliateUrl.trim(),
          imageUrl: productImageUrl.trim(),
          targetAudience: "20~40대 한국 시청자",
          shortsDuration: duration,
          tone,
          blogGoal: "sales",
          blogLength: "standard",
        }),
      },
    );

    if (!data.result) throw new Error("쇼츠 전략 패키지를 받지 못했습니다.");

    setFactoryResult(data.result);
    setDraftVoiceover(data.result.shorts.voiceover);
    markStep("strategy", "done", `${data.result.shorts.durationSeconds}초 대본·${data.result.shorts.scenes.length}개 장면`);
    setMessage("대본과 장면표가 준비됐습니다. 대표님이 수정한 내용은 프로젝트 지시문에 반영됩니다.");
    setActiveStep("assets");
    return data.result;
  }

  async function generateStrategy() {
    if (busy) return;
    setBusy("strategy");
    setError("");
    try {
      await generateStrategyCore();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "쇼츠 전략 생성 실패";
      setError(reason);
      markStep("strategy", "error", reason);
    } finally {
      setBusy("");
    }
  }

  async function uploadReferencesCore(): Promise<string[]> {
    markStep("assets", "running");
    setMessage("상품 사진을 저장소에 올리고 프로젝트 소재로 연결하고 있습니다.");

    let uploaded: string[] = [];
    if (imageFiles.length) {
      const form = new FormData();
      imageFiles.slice(0, 4).forEach((file) => form.append("images", file));
      const data = await jsonRequest<{ success?: boolean; urls?: string[] }>(
        "/api/creative-studio-pro/references",
        { method: "POST", body: form },
      );
      uploaded = Array.isArray(data.urls) ? data.urls : [];
    }

    const directImage = productImageUrl.trim().startsWith("https://") ? productImageUrl.trim() : "";
    const urls = Array.from(new Set([...uploaded, directImage].filter(Boolean))).slice(0, 4);

    if (!urls.length) {
      throw new Error("실제 상품 사진 1장 이상을 선택하거나 상품 이미지 주소를 입력해주세요.");
    }

    setReferenceImageUrls(urls);
    markStep("assets", "done", `상품 사진 ${urls.length}장 연결`);
    setMessage("상품 소재가 준비됐습니다. 이제 영상 프로젝트와 장면을 생성합니다.");
    setActiveStep("project");
    return urls;
  }

  async function uploadReferences() {
    if (busy) return;
    setBusy("assets");
    setError("");
    try {
      await uploadReferencesCore();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "상품 사진 업로드 실패";
      setError(reason);
      markStep("assets", "error", reason);
    } finally {
      setBusy("");
    }
  }

  function buildMasterPrompt(result: ContentFactoryPackage) {
    const scenePlan = result.shorts.scenes
      .map((scene, index) => `${index + 1}. ${scene.start}~${scene.end}초 | ${scene.visual} | 자막: ${scene.subtitle}`)
      .join("\n");

    return [
      "GY 쇼핑 쇼츠 제작 캔버스 승인 지시",
      `제작 방식: ${sourceStrategy}`,
      `첫 2초 훅: ${result.shorts.hook}`,
      `승인 대본: ${draftVoiceover || result.shorts.voiceover}`,
      `장면 계획:\n${scenePlan}`,
      "실제 상품의 색상·형태·버튼·로고·구성품을 바꾸지 않는다.",
      "과장된 효능·가격·수익 보장을 피한다.",
      "한국 시청자가 바로 이해할 수 있게 문제-사용-혜택-CTA 순서로 제작한다.",
      sourceStrategy === "china-reference"
        ? "중국 인기영상은 훅·촬영각도·리듬만 참고하고 원본 클립은 최종 영상에 사용하지 않는다."
        : "대표님이 제공한 상품 사진을 중심으로 새로운 한국형 장면을 만든다.",
    ].join("\n\n");
  }

  async function attachChinaReference(id: string) {
    if (sourceStrategy !== "china-reference") return;

    try {
      setMessage("도우인·샤오홍슈의 인기 구조를 참고자료로 분석하고 있습니다.");
      const trend = await jsonRequest<{ results?: Array<Record<string, unknown>> }>(
        "/api/creative-studio-pro/china-search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: productName, platform: "all", limit: 8 }),
        },
      );

      const now = Date.now();
      const references = (Array.isArray(trend.results) ? trend.results.slice(0, 4) : [])
        .map((item, index) => ({
          id: `canvas-trend-${now}-${index}`,
          platform: item.platform === "xiaohongshu" ? "xiaohongshu" : "douyin",
          url: String(item.url || ""),
          title: String(item.title || `중국 인기 구조 ${index + 1}`),
          assetKind: "page-link",
          rightsStatus: "unverified",
          useInFinal: false,
          includeInMixAnalysis: true,
          notes: "훅·촬영각도·판매 순서만 분석하며 원본 영상은 최종본에 사용하지 않습니다.",
          analysisFrameUrls: item.thumbnailUrl ? [String(item.thumbnailUrl)] : [],
          selectedKeywords: [],
          durationSeconds: null,
          trimStartSecond: 0,
          trimEndSecond: null,
          createdAt: new Date().toISOString(),
        }))
        .filter((item) => item.url.startsWith("https://"));

      if (!references.length) return;

      await jsonRequest(`/api/creative-studio-pro/projects/${id}/media-references`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references }),
      });
      await jsonRequest(`/api/creative-studio-pro/projects/${id}/editor-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playbackSpeed: 1.2,
          subtitleCleanupMode: "recreate-clean",
          sourceAudioMode: "mute-korean-tts",
          mixStrategy: "recreate",
        }),
      });
      await jsonRequest(`/api/creative-studio-pro/projects/${id}/source-mix`, { method: "POST" });
    } catch (cause) {
      setMessage(`중국 구조 분석은 건너뛰고 한국형 상품정보로 계속합니다. ${cause instanceof Error ? cause.message : ""}`.trim());
    }
  }

  async function createProjectCore(
    result: ContentFactoryPackage,
    references: string[],
  ): Promise<{ id: string; sceneCount: number }> {
    markStep("project", "running");
    setMessage("대본·썸네일·음악 설정을 하나의 영상 프로젝트로 묶고 있습니다.");

    const projectReferences = sourceStrategy === "single-photo" ? references.slice(0, 1) : references;

    const data = await jsonRequest<{
      success?: boolean;
      project?: ProjectRecord;
      scenes?: ProjectScene[];
    }>("/api/creative-studio-pro/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${productName} 쇼핑 쇼츠`,
        productName,
        productDescription: description || `${productName} 상품 소개`,
        productUrl: affiliateUrl,
        affiliateUrl,
        masterPrompt: buildMasterPrompt(result),
        sourceMode: projectReferences.length === 1 ? "single-photo-commerce" : "premium-multi-photo",
        sourceImageUrl: projectReferences[0],
        referenceImageUrls: projectReferences,
        duration,
        ratio: "720:1280",
        style,
        subtitleMode: "korean",
        voiceMode: "female",
        voicePreset,
        musicMood,
        subtitleStyle: "bold-pop",
        thumbnailStyle: "benefit-arrow",
        sfxMode,
        platformTargets: ["youtube", "instagram"],
        qualityThreshold: 85,
        maxImageRetries: 2,
      }),
    });

    if (!data.project?.id) throw new Error("영상 프로젝트 ID를 받지 못했습니다.");

    const id = data.project.id;
    const sceneCount = Math.max(1, data.scenes?.length || Math.ceil(duration / 5));
    setProjectId(id);
    setProjectDetail(data.project);
    setProjectScenes(Array.isArray(data.scenes) ? data.scenes : []);

    await attachChinaReference(id);

    await jsonRequest(`/api/creative-studio-pro/projects/${id}/productization`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    await jsonRequest(`/api/creative-studio-pro/projects/${id}/content-approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hookIndex: 0 }),
    });

    const latest = await jsonRequest<ProjectResponse>(`/api/creative-studio-pro/projects/${id}`, { cache: "no-store" });
    setProjectDetail(latest.project || data.project);
    setProjectScenes(Array.isArray(latest.scenes) ? latest.scenes : data.scenes || []);
    markStep("project", "done", `${sceneCount}개 장면 프로젝트 생성`);
    setMessage("프로젝트가 저장됐습니다. 이제 장면 이미지를 만들고 품질을 검사합니다.");
    setActiveStep("scenes");
    return { id, sceneCount };
  }

  async function createProject() {
    if (busy) return;
    setBusy("project");
    setError("");

    try {
      const result = factoryResult || await generateStrategyCore();
      const references = referenceImageUrls.length ? referenceImageUrls : await uploadReferencesCore();
      await createProjectCore(result, references);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "프로젝트 생성 실패";
      setError(reason);
      markStep("project", "error", reason);
    } finally {
      setBusy("");
    }
  }

  async function prepareScenesCore(id: string, sceneCount: number) {
    markStep("scenes", "running");
    for (let index = 0; index < sceneCount * 3 + 2; index += 1) {
      const result = await jsonRequest<{ done?: boolean; message?: string }>(
        `/api/creative-studio-pro/projects/${id}/prepare-next`,
        { method: "POST" },
      );
      setMessage(result.message || `AI 장면 ${Math.min(index + 1, sceneCount)}개를 준비하고 있습니다.`);
      if (result.done) break;
    }

    const latest = await jsonRequest<ProjectResponse>(`/api/creative-studio-pro/projects/${id}`, { cache: "no-store" });
    setProjectScenes(Array.isArray(latest.scenes) ? latest.scenes : []);
    setProjectDetail(latest.project || projectDetail);
    markStep("scenes", "done", "85점 기준 장면 품질검수 완료");
    setMessage("장면 준비가 끝났습니다. 승인 대본으로 한국어 음성을 생성합니다.");
    setActiveStep("voice");
  }

  async function prepareScenes() {
    if (!projectId || busy) {
      if (!projectId) setError("먼저 영상 프로젝트를 만들어주세요.");
      return;
    }
    setBusy("scenes");
    setError("");
    try {
      await prepareScenesCore(projectId, Math.max(1, projectScenes.length || Math.ceil(duration / 5)));
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "장면 준비 실패";
      setError(reason);
      markStep("scenes", "error", reason);
    } finally {
      setBusy("");
    }
  }

  async function generateVoiceCore(id: string) {
    markStep("voice", "running");
    setMessage("승인 대본으로 한국어 음성을 만들고 음악·효과음 설정을 저장하고 있습니다.");
    await jsonRequest(`/api/creative-studio-pro/projects/${id}/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice: voicePreset }),
    });
    markStep("voice", "done", `${voicePreset} 음성 · ${musicMood} · 효과음 ${sfxMode}`);
    setMessage("음성 준비가 끝났습니다. Runway 장면 영상과 최종 MP4를 만들 차례입니다.");
    setActiveStep("render");
  }

  async function generateVoice() {
    if (!projectId || busy) {
      if (!projectId) setError("먼저 영상 프로젝트를 만들어주세요.");
      return;
    }
    setBusy("voice");
    setError("");
    try {
      await generateVoiceCore(projectId);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "음성 생성 실패";
      setError(reason);
      markStep("voice", "error", reason);
    } finally {
      setBusy("");
    }
  }

  async function pollProject(id: string): Promise<ProjectResponse> {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const data = await jsonRequest<ProjectResponse>(`/api/creative-studio-pro/projects/${id}`, { cache: "no-store" });
      if (data.project) setProjectDetail(data.project);
      if (Array.isArray(data.scenes)) setProjectScenes(data.scenes);
      if (data.project?.final_video_url) return data;
      if (data.renderJob?.status === "failed") {
        throw new Error(data.renderJob.error_message || "최종 영상 합성에 실패했습니다.");
      }
      setMessage(data.renderJob?.status === "rendering"
        ? "영상 Worker가 음성·자막·장면·음악을 최종 MP4로 합성하고 있습니다."
        : "영상 합성 대기열을 확인하고 있습니다.");
      await sleep(attempt === 0 ? 1200 : 4000);
    }
    throw new Error("영상 합성이 오래 걸리고 있습니다. 프로젝트 이력에서 상태를 확인해주세요.");
  }

  async function renderCore(id: string, sceneCount: number) {
    markStep("render", "running");
    setMessage("Runway 장면 영상을 만들고 있습니다. 사용량이 발생할 수 있습니다.");

    await jsonRequest(`/api/creative-studio-pro/projects/${id}/approve-render`, { method: "POST" });

    for (let index = 0; index < sceneCount + 2; index += 1) {
      const result = await jsonRequest<{ done?: boolean; message?: string }>(
        `/api/creative-studio-pro/projects/${id}/generate-next`,
        { method: "POST" },
      );
      setMessage(result.message || `Runway 장면 ${Math.min(index + 1, sceneCount)}개를 생성하고 있습니다.`);
      if (result.done) break;
    }

    setMessage("음성·자막·장면·음악을 최종 세로 MP4로 합성합니다.");
    await jsonRequest(`/api/creative-studio-pro/projects/${id}/render`, { method: "POST" });
    const completed = await pollProject(id);
    const videoUrl = completed.project?.final_video_url || "";
    if (!videoUrl) throw new Error("최종 MP4 주소를 받지 못했습니다.");

    setFinalVideoUrl(videoUrl);
    setProjectDetail(completed.project || projectDetail);
    setProjectScenes(Array.isArray(completed.scenes) ? completed.scenes : projectScenes);
    markStep("render", "done", "9:16 최종 MP4 완성");
    markStep("publish", "waiting", "대표 최종 승인 필요");
    setMessage("쇼핑 쇼츠가 완성됐습니다. 영상을 확인한 뒤 YouTube 비공개 게시를 승인하세요.");
    setActiveStep("publish");
  }

  async function renderVideo() {
    if (!projectId || busy) {
      if (!projectId) setError("먼저 영상 프로젝트를 만들어주세요.");
      return;
    }

    const confirmed = window.confirm(
      "Runway와 음성·이미지 생성 사용량이 발생할 수 있습니다. 최종 영상 제작을 시작할까요?",
    );
    if (!confirmed) return;

    setBusy("render");
    setError("");
    try {
      await renderCore(projectId, Math.max(1, projectScenes.length || Math.ceil(duration / 5)));
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "최종 영상 제작 실패";
      setError(reason);
      markStep("render", "error", reason);
    } finally {
      setBusy("");
    }
  }

  async function queuePrivateYouTube() {
    if (!projectId || !finalVideoUrl || busy || publishQueued) return;
    const confirmed = window.confirm("완성 영상을 YouTube 비공개 게시 대기열에 등록할까요?");
    if (!confirmed) return;

    setBusy("publish");
    setError("");
    markStep("publish", "running");
    try {
      const latest = await jsonRequest<ProjectResponse>(`/api/creative-studio-pro/projects/${projectId}`, { cache: "no-store" });
      const project = latest.project || projectDetail;
      const scenes = Array.isArray(latest.scenes) ? latest.scenes : projectScenes;
      const commerce = project?.settings?.commercePackage;
      const youtube = commerce?.platformVersions?.youtube;

      if (!project || !commerce || !youtube) {
        throw new Error("게시용 제목·설명 패키지를 찾지 못했습니다.");
      }

      const hashtags = Array.isArray(youtube.hashtags) ? youtube.hashtags : [];
      await jsonRequest("/api/publishing/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: ["youtube"],
          title: youtube.title || commerce.title || project.title,
          content: `${youtube.description || commerce.description || project.product_description || ""}

${commerce.disclosure || "이 콘텐츠는 제휴 활동의 일환으로 일정액의 수수료를 제공받을 수 있습니다."}
${commerce.cta || "상품 링크에서 자세히 확인하세요."}`.trim(),
          scheduledAt: new Date().toISOString(),
          payload: {
            videoUrl: finalVideoUrl,
            thumbnailUrl: scenes.find((scene) => scene.selected_image_url)?.selected_image_url || "",
            tags: hashtags.map((tag) => String(tag).replace(/^#/, "")),
            privacyStatus: "private",
            sourceProjectId: projectId,
            gyProductCode: commerce.productCode || `GY-${Date.now()}`,
          },
        }),
      });

      setPublishQueued(true);
      markStep("publish", "done", "YouTube 비공개 대기열 등록");
      setMessage("비공개 게시 대기열에 등록했습니다. 게시센터에서 최종 실행할 수 있습니다.");
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "비공개 게시 등록 실패";
      setError(reason);
      markStep("publish", "error", reason);
    } finally {
      setBusy("");
    }
  }

  async function runAutomatic() {
    if (busy) return;
    if (!productName.trim()) {
      setError("제휴링크에서 상품을 불러오거나 상품명을 먼저 입력해주세요.");
      setActiveStep("product");
      return;
    }

    const confirmed = window.confirm(
      `${productName}

대본·이미지·음성·Runway·최종 MP4까지 자동 제작할까요?
AI 사용량이 발생할 수 있으며 공개 게시 전에는 대표님 승인이 필요합니다.`,
    );
    if (!confirmed) return;

    setBusy("auto");
    setError("");
    setMessage("완전자동 제작을 시작합니다.");

    try {
      const result = factoryResult || await generateStrategyCore();
      const references = referenceImageUrls.length ? referenceImageUrls : await uploadReferencesCore();
      const created = projectId
        ? { id: projectId, sceneCount: Math.max(1, projectScenes.length || Math.ceil(duration / 5)) }
        : await createProjectCore(result, references);

      await prepareScenesCore(created.id, created.sceneCount);
      await generateVoiceCore(created.id);
      await renderCore(created.id, created.sceneCount);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "완전자동 제작이 중단됐습니다.";
      setError(reason);
      setMessage("완료된 단계는 저장돼 있습니다. 오류가 난 단계부터 다시 실행할 수 있습니다.");
      const running = steps.find((step) => step.state === "running");
      if (running) markStep(running.key, "error", reason);
    } finally {
      setBusy("");
    }
  }

  function downloadProductionPackage() {
    if (!factoryResult) {
      setError("먼저 키워드·대본을 생성해주세요.");
      return;
    }

    const content = [
      `# ${factoryResult.shorts.title}`,
      "",
      "## 상품",
      `- 상품명: ${productName}`,
      `- 가격: ${priceText || "확인 필요"}`,
      `- 플랫폼: ${platform || "직접 입력"}`,
      `- 제휴링크: ${affiliateUrl}`,
      "",
      "## 훅",
      factoryResult.shorts.hook,
      "",
      "## 승인 대본",
      draftVoiceover || factoryResult.shorts.voiceover,
      "",
      "## 장면표",
      ...factoryResult.shorts.scenes.map((scene, index) =>
        `${index + 1}. ${scene.start}~${scene.end}초 | ${scene.visual} | ${scene.subtitle}`),
      "",
      "## 썸네일",
      ...factoryResult.creative.thumbnailCopy.map((copy) => `- ${copy}`),
      "",
      "## 게시 설명",
      factoryResult.shorts.description,
      "",
      "## 고정댓글",
      factoryResult.shorts.pinnedComment,
    ].join("\n");

    downloadText(`${safeFileName(productName)}-제작패키지.md`, content, "text/markdown");
    downloadText(`${safeFileName(productName)}.srt`, factoryResult.subtitles.srt);
    setMessage("대본·장면표·SRT 제작 패키지를 다운로드했습니다.");
  }

  const advisorText = useMemo(() => {
    if (error) return "오류가 난 단계만 다시 실행하세요. 이전에 완료된 단계와 프로젝트 데이터는 유지됩니다.";
    if (!nextWaitingStep) return "제작과 비공개 게시 준비가 끝났습니다. 성과 데이터가 쌓이면 다음 쇼츠의 훅·길이·썸네일을 개선합니다.";
    const advice: Record<StepKey, string> = {
      product: "제휴링크를 붙여넣고 상품 불러오기를 먼저 실행하세요. 상품명·이미지·가격이 부족하면 직접 보완할 수 있습니다.",
      strategy: "첫 2초 훅과 대본을 만든 뒤 대표님 말투에 맞게 수정하세요. 수정한 대본은 프로젝트 제작 지시문에 들어갑니다.",
      assets: "실제 상품 사진은 최소 1장, 가능하면 서로 다른 각도 2~4장이 좋습니다. 상품 형태 정확도가 올라갑니다.",
      project: "한국형 직접 제작 또는 중국 인기 구조 참고 방식을 선택하고 프로젝트를 생성하세요.",
      scenes: "AI가 상품 장면을 만들고 85점 기준으로 자동 검수합니다. 불량 장면만 다시 생성할 수 있는 기반입니다.",
      voice: "목소리·음악 분위기·효과음 강도를 선택하세요. 음성은 자막과 장면 길이에 맞춰 생성됩니다.",
      render: "Runway 사용량이 발생할 수 있습니다. 장면과 음성을 확인한 뒤 최종 MP4 제작을 승인하세요.",
      publish: "완성 영상을 확인한 뒤 YouTube 비공개 대기열에만 등록합니다. 공개 전 대표님 최종 승인을 유지합니다.",
    };
    return advice[nextWaitingStep.key];
  }, [error, nextWaitingStep]);

  function renderStepContent() {
    if (activeStep === "product") {
      return (
        <section className={styles.stageCard}>
          <div className={styles.stageHeading}>
            <div><span>STEP 01</span><h2>상품·제휴링크</h2></div>
            <strong>{priceText || "가격 미확인"}</strong>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.wide}>제휴링크
              <div className={styles.inlineField}>
                <input value={affiliateUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => setAffiliateUrl(event.target.value)} placeholder="https:// 제휴링크를 붙여넣으세요" />
                <button type="button" onClick={() => void importAffiliateProduct()} disabled={Boolean(busy)}>
                  {busy === "product" ? "불러오는 중" : "상품 불러오기"}
                </button>
              </div>
            </label>
            <label>상품명<input value={productName} onChange={(event: ChangeEvent<HTMLInputElement>) => setProductName(event.target.value)} /></label>
            <label>판매 플랫폼<input value={platform} onChange={(event: ChangeEvent<HTMLInputElement>) => setPlatform(event.target.value)} placeholder="쿠팡·Temu 등" /></label>
            <label className={styles.wide}>상품 설명<textarea rows={5} value={description} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDescription(event.target.value)} /></label>
            <label className={styles.wide}>상품 이미지 주소<input value={productImageUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => setProductImageUrl(event.target.value)} placeholder="https://" /></label>
          </div>
          <button className={styles.primary} type="button" onClick={() => { markStep("product", "done", productName || "상품정보 직접 입력"); moveTo("strategy"); }} disabled={!productName.trim()}>
            상품정보 확정
          </button>
        </section>
      );
    }

    if (activeStep === "strategy") {
      return (
        <section className={styles.stageCard}>
          <div className={styles.stageHeading}>
            <div><span>STEP 02</span><h2>키워드·훅·대본</h2></div>
            <button type="button" className={styles.subtle} onClick={downloadProductionPackage}>SRT·패키지 저장</button>
          </div>
          <div className={styles.formGrid}>
            <label>길이<select value={duration} onChange={(event: ChangeEvent<HTMLSelectElement>) => setDuration(Number(event.target.value) as 15 | 20 | 25 | 30)}>
              {[15, 20, 25, 30].map((value) => <option key={value} value={value}>{value}초</option>)}
            </select></label>
            <label>톤<select value={tone} onChange={(event: ChangeEvent<HTMLSelectElement>) => setTone(event.target.value)}>
              <option>친근하고 재미있는 생활 밀착형</option>
              <option>빠르고 강한 쇼핑 전환형</option>
              <option>신뢰감 있고 자연스러운 전문가형</option>
              <option>감성적인 프리미엄 스토리형</option>
            </select></label>
          </div>
          <button className={styles.primary} type="button" onClick={() => void generateStrategy()} disabled={Boolean(busy)}>
            {busy === "strategy" ? "Dream Y가 제작 중..." : "키워드·대본·장면표 생성"}
          </button>
          {factoryResult && (
            <div className={styles.resultStack}>
              <article><span>제목</span><strong>{factoryResult.shorts.title}</strong></article>
              <article><span>첫 2초 훅</span><strong>{factoryResult.shorts.hook}</strong></article>
              <label>대표님 승인 대본
                <textarea rows={8} value={draftVoiceover} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraftVoiceover(event.target.value)} />
              </label>
              <div className={styles.sceneList}>
                {factoryResult.shorts.scenes.map((scene, index) => (
                  <div key={`${scene.start}-${index}`}>
                    <b>{scene.start}~{scene.end}초</b>
                    <p>{scene.visual}</p>
                    <em>{scene.subtitle}</em>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      );
    }

    if (activeStep === "assets") {
      return (
        <section className={styles.stageCard}>
          <div className={styles.stageHeading}><div><span>STEP 03</span><h2>상품 사진 소재</h2></div><strong>{referenceImageUrls.length}장 연결</strong></div>
          <label className={styles.uploadBox}>
            <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => setImageFiles(Array.from(event.target.files || []).slice(0, 4))} />
            <span>PNG·JPG·WEBP 상품 사진 1~4장 선택</span>
            <small>서로 다른 각도의 실제 상품 사진을 권장합니다.</small>
          </label>
          {imageFiles.length > 0 && <div className={styles.fileChips}>{imageFiles.map((file) => <span key={`${file.name}-${file.size}`}>{file.name}</span>)}</div>}
          {productImageUrl && <p className={styles.helper}>제휴 상품 이미지 주소도 함께 사용할 수 있습니다.</p>}
          <button className={styles.primary} type="button" onClick={() => void uploadReferences()} disabled={Boolean(busy)}>
            {busy === "assets" ? "소재 연결 중..." : "상품 사진 저장·연결"}
          </button>
        </section>
      );
    }

    if (activeStep === "project") {
      return (
        <section className={styles.stageCard}>
          <div className={styles.stageHeading}><div><span>STEP 04</span><h2>제작 방식과 프로젝트</h2></div><strong>{projectId ? "저장됨" : "미생성"}</strong></div>
          <div className={styles.choiceGrid}>
            <button type="button" className={sourceStrategy === "korean-original" ? styles.selectedChoice : ""} onClick={() => setSourceStrategy("korean-original")}>
              <b>한국형 직접 제작</b><span>내 상품 사진과 한국형 대본 중심</span>
            </button>
            <button type="button" className={sourceStrategy === "china-reference" ? styles.selectedChoice : ""} onClick={() => setSourceStrategy("china-reference")}>
              <b>중국 인기 구조 참고</b><span>도우인·샤오홍슈의 훅과 리듬만 분석</span>
            </button>
            <button type="button" className={sourceStrategy === "single-photo" ? styles.selectedChoice : ""} onClick={() => setSourceStrategy("single-photo")}>
              <b>사진 한 장 AI 쇼츠</b><span>상품 이미지 한 장으로 새 장면 생성</span>
            </button>
          </div>
          <div className={styles.formGrid}>
            <label>영상 스타일<select value={style} onChange={(event: ChangeEvent<HTMLSelectElement>) => setStyle(event.target.value as typeof style)}>
              <option value="problem-solution">문제 해결형</option>
              <option value="ugc-review">UGC 리뷰형</option>
              <option value="how-to">사용법형</option>
              <option value="cinematic-product">시네마틱 제품형</option>
            </select></label>
            <label>품질 기준<input value="85점 · 최대 2회 재생성" readOnly /></label>
          </div>
          <button className={styles.primary} type="button" onClick={() => void createProject()} disabled={Boolean(busy)}>
            {busy === "project" ? "프로젝트 생성 중..." : "영상 프로젝트 생성"}
          </button>
          {projectId && <p className={styles.projectCode}>프로젝트 ID: {projectId}</p>}
        </section>
      );
    }

    if (activeStep === "scenes") {
      return (
        <section className={styles.stageCard}>
          <div className={styles.stageHeading}><div><span>STEP 05</span><h2>AI 장면·품질검수</h2></div><strong>{projectScenes.length}개 장면</strong></div>
          <div className={styles.sceneList}>
            {projectScenes.length ? projectScenes.map((scene, index) => (
              <div key={scene.id || index}>
                <b>장면 {scene.scene_number || index + 1}</b>
                <p>{scene.narration || scene.role || "장면 기획 준비"}</p>
                <em>{scene.quality_status || scene.status || "대기"}</em>
              </div>
            )) : <p className={styles.helper}>프로젝트를 만든 뒤 AI 장면 준비를 실행하세요.</p>}
          </div>
          <button className={styles.primary} type="button" onClick={() => void prepareScenes()} disabled={Boolean(busy) || !projectId}>
            {busy === "scenes" ? "장면 제작·검수 중..." : "전체 장면 제작·85점 검수"}
          </button>
        </section>
      );
    }

    if (activeStep === "voice") {
      return (
        <section className={styles.stageCard}>
          <div className={styles.stageHeading}><div><span>STEP 06</span><h2>음성·음악·효과음</h2></div><strong>오디오 레이어</strong></div>
          <div className={styles.formGrid}>
            <label>한국어 음성<select value={voicePreset} onChange={(event: ChangeEvent<HTMLSelectElement>) => setVoicePreset(event.target.value as typeof voicePreset)}>
              <option value="marin">Marin · 자연스러운 여성</option>
              <option value="coral">Coral · 밝고 친근한 여성</option>
              <option value="shimmer">Shimmer · 부드러운 여성</option>
              <option value="cedar">Cedar · 신뢰형 남성</option>
              <option value="onyx">Onyx · 낮고 강한 남성</option>
              <option value="echo">Echo · 차분한 남성</option>
            </select></label>
            <label>배경음악 분위기<select value={musicMood} onChange={(event: ChangeEvent<HTMLSelectElement>) => setMusicMood(event.target.value)}>
              <option value="bright-commerce">밝고 빠른 쇼핑형</option>
              <option value="summer-fresh">여름·시원함</option>
              <option value="warm-lifestyle">따뜻한 생활형</option>
              <option value="premium-clean">프리미엄·깔끔함</option>
              <option value="modern-corporate">현대적 정보형</option>
            </select></label>
            <label>효과음<select value={sfxMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSfxMode(event.target.value as typeof sfxMode)}>
              <option value="recommended">장면별 자동 추천</option>
              <option value="minimal">최소 사용</option>
              <option value="none">사용 안 함</option>
            </select></label>
            <label>믹싱 원칙<input value="음성 우선 · 음악 자동 감쇄 · CTA 페이드아웃" readOnly /></label>
          </div>
          <p className={styles.helper}>YouTube 오디오 라이브러리 음원 업로드 기능은 다음 오디오 편집 단계에서 붙이고, 현재는 프로젝트 음악 분위기와 효과음 지시를 렌더 엔진에 전달합니다.</p>
          <button className={styles.primary} type="button" onClick={() => void generateVoice()} disabled={Boolean(busy) || !projectId}>
            {busy === "voice" ? "한국어 음성 생성 중..." : "음성·오디오 설정 생성"}
          </button>
        </section>
      );
    }

    if (activeStep === "render") {
      return (
        <section className={styles.stageCard}>
          <div className={styles.stageHeading}><div><span>STEP 07</span><h2>Runway 장면·최종 MP4</h2></div><strong>{finalVideoUrl ? "완성" : "제작 전"}</strong></div>
          <div className={styles.engineFlow}>
            <span>상품 사진</span><i>→</i><span>AI 장면</span><i>→</i><span>Runway 영상</span><i>→</i><span>음성·자막·음악</span><i>→</i><span>9:16 MP4</span>
          </div>
          <button className={styles.primary} type="button" onClick={() => void renderVideo()} disabled={Boolean(busy) || !projectId}>
            {busy === "render" ? "영상 제작·합성 중..." : "Runway·최종 MP4 제작"}
          </button>
          {finalVideoUrl && (
            <div className={styles.videoResult}>
              <video controls playsInline src={finalVideoUrl} />
              <a href={finalVideoUrl} target="_blank" rel="noreferrer">완성 MP4 열기</a>
            </div>
          )}
        </section>
      );
    }

    return (
      <section className={styles.stageCard}>
        <div className={styles.stageHeading}><div><span>STEP 08</span><h2>검수·비공개 게시</h2></div><strong>{publishQueued ? "대기열 등록" : "대표 승인 필요"}</strong></div>
        {finalVideoUrl ? <video className={styles.publishVideo} controls playsInline src={finalVideoUrl} /> : <p className={styles.helper}>최종 MP4가 완성되면 이 화면에서 확인할 수 있습니다.</p>}
        <div className={styles.publishChecklist}>
          <span>첫 2초 훅</span><span>상품 형태</span><span>한국어 자막</span><span>음성·음악 밸런스</span><span>제휴 고지</span><span>썸네일</span>
        </div>
        <button className={styles.primary} type="button" onClick={() => void queuePrivateYouTube()} disabled={Boolean(busy) || !finalVideoUrl || publishQueued}>
          {publishQueued ? "YouTube 비공개 대기열 등록 완료" : busy === "publish" ? "게시 대기열 등록 중..." : "YouTube 비공개 게시 대기열 등록"}
        </button>
        <div className={styles.internalLinks}>
          <Link href="/admin/publishing">게시센터 확인</Link>
          <Link href="/admin/analytics">조회수·클릭 분석</Link>
          <Link href="/admin/content-factory">같은 상품으로 블로그 만들기</Link>
        </div>
      </section>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span>GY SHOPPING SHORTS CANVAS · PHASE 1</span>
          <h1>쇼핑 쇼츠 AI 제작 캔버스</h1>
          <p>상품 하나를 기준으로 대본·사진·장면·음성·음악·자막·최종 MP4·비공개 게시까지 한 프로젝트 안에서 이어서 제작합니다.</p>
        </div>
        <div className={styles.heroSide}>
          <div className={styles.progressRing}><strong>{progressPercent}%</strong><span>{completedCount}/{steps.length} 완료</span></div>
          <button type="button" className={styles.autoButton} onClick={() => void runAutomatic()} disabled={Boolean(busy)}>
            {busy === "auto" ? "Dream Y 자동 제작 중..." : "완전자동 제작 시작"}
          </button>
        </div>
      </header>

      <section className={styles.modeBar}>
        <div>
          <b>제작 모드</b>
          <span>같은 프로젝트를 수동·반자동·자동으로 운영합니다.</span>
        </div>
        <div className={styles.modeButtons}>
          <button className={mode === "manual" ? styles.activeMode : ""} onClick={() => setMode("manual")}>수동</button>
          <button className={mode === "guided" ? styles.activeMode : ""} onClick={() => setMode("guided")}>반자동</button>
          <button className={mode === "auto" ? styles.activeMode : ""} onClick={() => setMode("auto")}>완전자동</button>
        </div>
      </section>

      {(message || error) && (
        <div className={error ? styles.error : styles.notice}>
          <b>{error ? "확인 필요" : "진행 상태"}</b>
          <span>{error || message}</span>
        </div>
      )}

      <section className={styles.workspace}>
        <nav className={styles.stepRail} aria-label="쇼핑 쇼츠 제작 단계">
          {steps.map((step) => (
            <button
              type="button"
              key={step.key}
              className={`${styles.stepButton} ${activeStep === step.key ? styles.activeStep : ""} ${styles[step.state]}`}
              onClick={() => moveTo(step.key)}
            >
              <span>{step.number}</span>
              <div><b>{step.label}</b><small>{step.detail || step.description}</small></div>
              <i>{step.state === "done" ? "✓" : step.state === "running" ? "…" : step.state === "error" ? "!" : "›"}</i>
            </button>
          ))}
        </nav>

        <div className={styles.canvas}>
          <div className={styles.canvasTop}>
            <div>
              <small>{currentStep.number} · {currentStep.label}</small>
              <strong>{productName || "새 쇼핑 쇼츠 프로젝트"}</strong>
            </div>
            <span>{mode === "manual" ? "대표 직접 제어" : mode === "guided" ? "Dream Y 단계별 제작" : "Dream Y 완전자동"}</span>
          </div>
          {renderStepContent()}
        </div>

        <aside className={styles.advisor}>
          <span>DREAM Y · COMPANY ARCHITECT</span>
          <h2>다음 판단</h2>
          <p>{advisorText}</p>
          <div className={styles.engineStatus}>
            <div><b>Dream Y</b><span>대본·판매 구조</span></div>
            <div><b>OpenAI</b><span>이미지·음성·품질검수</span></div>
            <div><b>Runway</b><span>장면 영상 생성</span></div>
            <div><b>Video Worker</b><span>음성·자막·MP4 합성</span></div>
            <div><b>YouTube</b><span>비공개 게시 대기</span></div>
          </div>
          {factoryResult && (
            <div className={styles.miniSummary}>
              <small>현재 훅</small>
              <strong>{factoryResult.shorts.hook}</strong>
              <small>SEO</small>
              <p>{factoryResult.seo.primaryKeyword}</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
