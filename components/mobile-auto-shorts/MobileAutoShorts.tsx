"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./MobileAutoShorts.module.css";

type Candidate = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  affiliateUrl: string;
  platform: string;
  priceText: string;
  aiScore: number;
  profitOpportunityScore: number;
  opportunityGrade: string;
  dataQualityScore: number;
  externalRank: number | null;
};

type ImportedProduct = {
  name: string;
  description: string;
  imageUrl: string;
  priceText: string;
  platform: string;
  finalUrl: string;
  source: "database" | "page-metadata" | "link-only";
  warning?: string;
};

type DraftProduct = {
  title: string;
  description: string;
  imageUrl: string;
  priceText: string;
  platform: string;
  affiliateUrl: string;
};

type ProgressItem = {
  key: string;
  label: string;
  state: "waiting" | "running" | "done" | "error";
  detail?: string;
};

type CommercePackage = {
  productCode?: string;
  title?: string;
  description?: string;
  disclosure?: string;
  cta?: string;
  hookOptions?: string[];
  platformVersions?: {
    youtube?: {
      title?: string;
      description?: string;
      hashtags?: string[];
    };
  };
};

type ProjectDetail = {
  id: string;
  title: string;
  product_name: string;
  product_description?: string;
  final_video_url?: string | null;
  settings?: {
    commercePackage?: CommercePackage;
    contentApprovedAt?: string;
  } | null;
};

type ProjectScene = {
  selected_image_url?: string | null;
};

type ProjectResponse = {
  success?: boolean;
  message?: string;
  project?: ProjectDetail;
  scenes?: ProjectScene[];
  renderJob?: { status?: string; error_message?: string } | null;
};

const initialProgress: ProgressItem[] = [
  { key: "project", label: "상품 프로젝트 생성", state: "waiting" },
  { key: "trend", label: "중국 인기 구조 분석", state: "waiting" },
  { key: "package", label: "한국형 대본·자막·썸네일", state: "waiting" },
  { key: "images", label: "AI 장면 생성·품질검수", state: "waiting" },
  { key: "voice", label: "한국어 AI 음성", state: "waiting" },
  { key: "runway", label: "Runway 장면 영상", state: "waiting" },
  { key: "render", label: "최종 9:16 MP4 합성", state: "waiting" },
  { key: "publish", label: "비공개 배포 승인 대기", state: "waiting" },
];

function parsePrice(value: string) {
  const number = Number(String(value || "").replace(/[^\d]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatWon(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString("ko-KR")}원`;
}

async function jsonRequest<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  let data: unknown = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  const object = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (!response.ok || object.success === false) {
    throw new Error(String(object.message || `${response.status} 요청 실패`));
  }
  return data as T;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function MobileAutoShorts({ candidates, loadError }: { candidates: Candidate[]; loadError?: string }) {
  const [candidateList, setCandidateList] = useState<Candidate[]>(candidates);
  const [selectedId, setSelectedId] = useState(candidates[0]?.id || "");
  const [commissionRate, setCommissionRate] = useState(3);
  const [duration, setDuration] = useState<15 | 20 | 25 | 30>(20);
  const [voicePreset, setVoicePreset] = useState("marin");
  const [affiliateInput, setAffiliateInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [draftProduct, setDraftProduct] = useState<DraftProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("대표님이 상품을 고르고 승인하면 창작 자동화가 시작됩니다.");
  const [error, setError] = useState(loadError || "");
  const [progress, setProgress] = useState<ProgressItem[]>(initialProgress);
  const [projectId, setProjectId] = useState("");
  const [finalVideoUrl, setFinalVideoUrl] = useState("");
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [projectScenes, setProjectScenes] = useState<ProjectScene[]>([]);
  const [publishQueued, setPublishQueued] = useState(false);

  const selected = useMemo(
    () => candidateList.find((candidate) => candidate.id === selectedId) || candidateList[0] || null,
    [candidateList, selectedId],
  );

  const estimatedPerOrder = useMemo(
    () => parsePrice(selected?.priceText || "") * Math.max(0, commissionRate) / 100,
    [selected?.priceText, commissionRate],
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("gy-mobile-auto-shorts-settings");
      if (!saved) return;
      const parsed = JSON.parse(saved) as { commissionRate?: number; duration?: number; voicePreset?: string };
      if (Number.isFinite(parsed.commissionRate)) setCommissionRate(Number(parsed.commissionRate));
      if ([15, 20, 25, 30].includes(Number(parsed.duration))) setDuration(Number(parsed.duration) as 15 | 20 | 25 | 30);
      if (parsed.voicePreset) setVoicePreset(parsed.voicePreset);
    } catch {
      // 기기 저장 설정이 손상된 경우 기본값으로 계속합니다.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("gy-mobile-auto-shorts-settings", JSON.stringify({ commissionRate, duration, voicePreset }));
    } catch {
      // 사생활 보호 모드에서는 저장하지 않고 현재 화면에서만 사용합니다.
    }
  }, [commissionRate, duration, voicePreset]);

  function addDraftCandidate(draft: DraftProduct, notice?: string) {
    if (!draft.title.trim()) throw new Error("상품명을 입력해주세요.");
    if (!/^https?:\/\//i.test(draft.affiliateUrl)) throw new Error("올바른 제휴링크를 입력해주세요.");
    if (!/^https?:\/\//i.test(draft.imageUrl)) throw new Error("상품 이미지 주소를 입력해주세요.");
    const id = `imported-${Date.now()}`;
    const item: Candidate = {
      id,
      title: draft.title.trim(),
      description: draft.description.trim(),
      imageUrl: draft.imageUrl.trim(),
      affiliateUrl: draft.affiliateUrl.trim(),
      platform: draft.platform.trim() || "etc",
      priceText: draft.priceText.trim() || "가격 확인 필요",
      aiScore: 70,
      profitOpportunityScore: 70,
      opportunityGrade: "B",
      dataQualityScore: draft.description.trim() ? 78 : 62,
      externalRank: null,
    };
    setCandidateList((current) => [item, ...current.filter((candidate) => candidate.affiliateUrl !== item.affiliateUrl)]);
    setSelectedId(id);
    setDraftProduct(draft);
    setMessage(notice || "불러온 상품을 선택했습니다. 설정을 확인한 뒤 자동 창작을 시작하세요.");
  }

  async function importAffiliateProduct() {
    if (!affiliateInput.trim() || importing) return;
    setImporting(true);
    setError("");
    setMessage("제휴링크에서 상품명·이미지·가격을 불러오고 있습니다.");
    try {
      const data = await jsonRequest<{ success?: boolean; product?: ImportedProduct }>("/api/revenue-shorts/product-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: affiliateInput.trim() }),
      });
      if (!data.product) throw new Error("상품 정보를 받지 못했습니다.");
      const draft: DraftProduct = {
        title: data.product.name || "",
        description: data.product.description || "",
        imageUrl: data.product.imageUrl || "",
        priceText: data.product.priceText || "",
        platform: data.product.platform || "etc",
        affiliateUrl: data.product.finalUrl || affiliateInput.trim(),
      };
      setDraftProduct(draft);
      if (draft.title && draft.imageUrl) {
        addDraftCandidate(draft, data.product.warning || "상품 정보를 불러와 자동 제작 후보에 추가했습니다.");
      } else {
        setMessage(data.product.warning || "판매 사이트 제한으로 일부 정보만 불러왔습니다. 아래 상품명과 이미지 주소를 보완해주세요.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "상품 정보를 불러오지 못했습니다.");
    } finally {
      setImporting(false);
    }
  }

  function saveDraftCandidate() {
    if (!draftProduct) return;
    try {
      setError("");
      addDraftCandidate(draftProduct);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "상품 정보를 확인해주세요.");
    }
  }

  function resetRun() {
    setProgress(initialProgress.map((item) => ({ ...item })));
    setProjectId("");
    setFinalVideoUrl("");
    setProjectDetail(null);
    setProjectScenes([]);
    setPublishQueued(false);
  }

  function mark(key: string, state: ProgressItem["state"], detail = "") {
    setProgress((current) => current.map((item) => item.key === key ? { ...item, state, detail } : item));
  }

  async function pollProject(id: string) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const data = await jsonRequest<ProjectResponse>(`/api/creative-studio-pro/projects/${id}`, { cache: "no-store" });
      if (data.project) {
        setProjectDetail(data.project);
        setProjectScenes(Array.isArray(data.scenes) ? data.scenes : []);
      }
      if (data.project?.final_video_url) return data;
      if (data.renderJob?.status === "failed") throw new Error(data.renderJob.error_message || "최종 영상 합성에 실패했습니다.");
      setMessage(data.renderJob?.status === "rendering" ? "영상 Worker가 최종 MP4를 합성하고 있습니다." : "영상 합성 대기열을 확인하고 있습니다.");
      await sleep(attempt === 0 ? 1200 : 4000);
    }
    throw new Error("영상 합성이 오래 걸리고 있습니다. 프로젝트 이력에서 상태를 확인해주세요.");
  }

  async function startAutomation() {
    if (!selected || busy) return;
    const confirmed = window.confirm(
      `${selected.title}\n\n이 상품으로 ${duration}초 쇼츠를 자동 제작할까요?\nOpenAI 이미지·음성 및 Runway 크레딧이 사용될 수 있습니다. 중국 영상은 참고 구조만 분석하고 최종본에는 새 AI 장면만 사용합니다.`,
    );
    if (!confirmed) return;

    resetRun();
    setBusy(true);
    setError("");
    setMessage("자동 제작을 시작합니다.");

    try {
      mark("project", "running");
      const created = await jsonRequest<{
        success: boolean;
        project: ProjectDetail;
        scenes: Array<{ id: string }>;
      }>("/api/creative-studio-pro/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${selected.title} 모바일 자동 쇼츠`,
          productName: selected.title,
          productDescription: selected.description || `${selected.title} 상품 소개`,
          productUrl: selected.affiliateUrl,
          affiliateUrl: selected.affiliateUrl,
          masterPrompt: "첫 2초는 문제 또는 결과가 즉시 보이는 강한 훅. 중국 인기 쇼츠의 리듬과 판매 구조만 참고하고, 원본 클립은 사용하지 않는다. 실제 상품 이미지 정체성을 유지한 새로운 한국형 광고 장면을 만든다.",
          sourceMode: "single-photo-commerce",
          sourceImageUrl: selected.imageUrl,
          referenceImageUrls: [selected.imageUrl],
          duration,
          ratio: "720:1280",
          style: "problem-solution",
          subtitleMode: "korean",
          voiceMode: "female",
          voicePreset,
          musicMood: "modern-corporate",
          subtitleStyle: "bold-pop",
          thumbnailStyle: "benefit-arrow",
          sfxMode: "recommended",
          platformTargets: ["youtube", "instagram"],
          qualityThreshold: 85,
          maxImageRetries: 2,
        }),
      });
      const id = created.project.id;
      const sceneCount = Math.max(1, created.scenes?.length || Math.ceil(duration / 5));
      setProjectId(id);
      setProjectDetail(created.project);
      mark("project", "done", `${sceneCount}개 장면 기획 완료`);

      mark("trend", "running");
      let trendResults: Array<Record<string, unknown>> = [];
      try {
        const trend = await jsonRequest<{
          results?: Array<Record<string, unknown>>;
          translatedProductName?: string;
          resultMode?: string;
        }>("/api/creative-studio-pro/china-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: selected.title, platform: "all", limit: 8 }),
        });
        trendResults = Array.isArray(trend.results) ? trend.results.slice(0, 4) : [];
        const now = Date.now();
        const references = trendResults.map((item, index) => ({
          id: `auto-trend-${now}-${index}`,
          platform: item.platform === "xiaohongshu" ? "xiaohongshu" : "douyin",
          url: String(item.url || ""),
          title: String(item.title || `중국 인기 구조 ${index + 1}`),
          assetKind: "page-link",
          rightsStatus: "unverified",
          useInFinal: false,
          includeInMixAnalysis: true,
          notes: "인기 훅·촬영각도·판매 순서만 분석합니다. 원본 영상은 최종본에 사용하지 않습니다.",
          analysisFrameUrls: item.thumbnailUrl ? [String(item.thumbnailUrl)] : [],
          selectedKeywords: [],
          durationSeconds: null,
          trimStartSecond: 0,
          trimEndSecond: null,
          createdAt: new Date().toISOString(),
        })).filter((item) => item.url.startsWith("https://"));

        if (references.length) {
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
        }
        mark("trend", "done", references.length ? `인기 구조 ${references.length}개 반영` : "검색 결과 없이 원본형 장면 설계");
      } catch (trendError) {
        mark("trend", "done", "검색 제한으로 상품 정보 기반 설계");
        setMessage(`중국 인기 검색은 건너뛰고 상품 정보 기반으로 계속 제작합니다. ${trendError instanceof Error ? trendError.message : ""}`.trim());
      }

      mark("package", "running");
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
      mark("package", "done", "첫 훅 1안·대본·자막·썸네일 승인");

      mark("images", "running");
      for (let index = 0; index < sceneCount * 3 + 2; index += 1) {
        const result = await jsonRequest<{ done?: boolean; readyForRunway?: boolean; message?: string }>(`/api/creative-studio-pro/projects/${id}/prepare-next`, { method: "POST" });
        setMessage(result.message || `AI 장면 ${Math.min(index + 1, sceneCount)}개를 준비하고 있습니다.`);
        if (result.done) break;
      }
      mark("images", "done", "85점 기준 자동 검수 완료");

      mark("voice", "running");
      await jsonRequest(`/api/creative-studio-pro/projects/${id}/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: voicePreset }),
      });
      mark("voice", "done", "검수 대본으로 음성 생성 완료");

      mark("runway", "running");
      await jsonRequest(`/api/creative-studio-pro/projects/${id}/approve-render`, { method: "POST" });
      for (let index = 0; index < sceneCount + 2; index += 1) {
        const result = await jsonRequest<{ done?: boolean; message?: string }>(`/api/creative-studio-pro/projects/${id}/generate-next`, { method: "POST" });
        setMessage(result.message || `Runway 장면 ${Math.min(index + 1, sceneCount)}개를 생성하고 있습니다.`);
        if (result.done) break;
      }
      mark("runway", "done", `${sceneCount}개 장면 영상 처리 완료`);

      mark("render", "running");
      await jsonRequest(`/api/creative-studio-pro/projects/${id}/render`, { method: "POST" });
      const completed = await pollProject(id);
      const videoUrl = completed.project?.final_video_url || "";
      if (!videoUrl) throw new Error("최종 MP4 주소를 받지 못했습니다.");
      setFinalVideoUrl(videoUrl);
      setProjectDetail(completed.project || created.project);
      setProjectScenes(Array.isArray(completed.scenes) ? completed.scenes : []);
      mark("render", "done", "세로형 MP4 완성");
      mark("publish", "running", "대표 최종 승인 필요");
      setMessage("쇼츠가 완성됐습니다. 아래 영상을 확인한 뒤 비공개 배포를 승인해주세요.");
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "자동 제작에 실패했습니다.";
      setError(reason);
      setProgress((current) => {
        const running = current.find((item) => item.state === "running");
        return current.map((item) => item.key === running?.key ? { ...item, state: "error", detail: reason } : item);
      });
      setMessage("중단된 단계부터 기존 Creative Studio Pro에서 이어서 작업할 수 있습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function queuePrivateYouTube() {
    if (!projectId || !finalVideoUrl || publishing || publishQueued) return;
    const confirmed = window.confirm("완성 영상을 YouTube 비공개 게시 대기열에 등록할까요? 공개 전 게시센터에서 다시 확인할 수 있습니다.");
    if (!confirmed) return;
    setPublishing(true);
    setError("");
    try {
      const latest = await jsonRequest<ProjectResponse>(`/api/creative-studio-pro/projects/${projectId}`, { cache: "no-store" });
      const project = latest.project || projectDetail;
      const scenes = Array.isArray(latest.scenes) ? latest.scenes : projectScenes;
      const commerce = project?.settings?.commercePackage;
      const youtube = commerce?.platformVersions?.youtube;
      if (!project || !commerce || !youtube) throw new Error("게시용 제목·설명 패키지를 찾지 못했습니다.");
      const hashtags = Array.isArray(youtube.hashtags) ? youtube.hashtags : [];
      await jsonRequest("/api/publishing/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: ["youtube"],
          title: youtube.title || commerce.title || project.title,
          content: `${youtube.description || commerce.description || project.product_description || ""}\n\n${commerce.disclosure || "이 콘텐츠는 제휴 활동의 일환으로 일정액의 수수료를 제공받을 수 있습니다."}\n${commerce.cta || "상품 링크에서 자세히 확인하세요."}`.trim(),
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
      mark("publish", "done", "YouTube 비공개 대기열 등록");
      setMessage("YouTube 비공개 게시 대기열에 등록했습니다. 통합 게시센터에서 최종 실행하면 됩니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "비공개 배포 대기열 등록 실패");
      mark("publish", "error", cause instanceof Error ? cause.message : "등록 실패");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span>GY MOBILE AUTO SHORTS · OWNER APPROVAL</span>
          <h1>상품 선택 한 번으로 창작부터 비공개 배포까지</h1>
          <p>수익기회 상위 상품을 고르면 중국 인기 구조를 참고해 새로운 한국형 쇼츠를 만들고, 완성본 확인 뒤 YouTube 비공개 대기열에 등록합니다.</p>
        </div>
        <a href="/admin/revenue-shorts">수동 통합 제작실</a>
      </header>

      {(message || error) && (
        <div className={error ? styles.alertError : styles.alert} role={error ? "alert" : "status"} aria-live="polite">
          <strong>{error ? "확인 필요" : "진행 상태"}</strong>
          <span>{error || message}</span>
        </div>
      )}

      <section className={styles.importPanel}>
        <div className={styles.importHeading}>
          <div><span>QUICK START</span><h2>제휴링크만 붙여넣어도 시작</h2></div>
          <small>쿠팡·Temu·네이버·알리 등 상품 페이지에서 정보를 자동으로 읽습니다.</small>
        </div>
        <div className={styles.importRow}>
          <input
            type="url"
            inputMode="url"
            value={affiliateInput}
            onChange={(event) => setAffiliateInput(event.target.value)}
            placeholder="https:// 제휴링크를 붙여넣으세요"
            aria-label="제휴 상품 링크"
            disabled={busy || importing}
          />
          <button type="button" onClick={() => void importAffiliateProduct()} disabled={busy || importing || !affiliateInput.trim()}>
            {importing ? "상품 불러오는 중" : "상품 자동 불러오기"}
          </button>
        </div>
        {draftProduct && (
          <details className={styles.importEditor} open={!draftProduct.title || !draftProduct.imageUrl}>
            <summary>불러온 상품 정보 확인·수정</summary>
            <div className={styles.importFields}>
              <label><span>상품명</span><input value={draftProduct.title} onChange={(event) => setDraftProduct({ ...draftProduct, title: event.target.value })} /></label>
              <label><span>가격 표시</span><input value={draftProduct.priceText} onChange={(event) => setDraftProduct({ ...draftProduct, priceText: event.target.value })} placeholder="예: 29,900원" /></label>
              <label className={styles.wide}><span>상품 이미지 주소</span><input type="url" inputMode="url" value={draftProduct.imageUrl} onChange={(event) => setDraftProduct({ ...draftProduct, imageUrl: event.target.value })} /></label>
              <label className={styles.wide}><span>상품 설명</span><textarea value={draftProduct.description} onChange={(event) => setDraftProduct({ ...draftProduct, description: event.target.value })} /></label>
            </div>
            <button type="button" className={styles.addCandidateButton} onClick={saveDraftCandidate} disabled={busy}>이 상품으로 제작 준비</button>
          </details>
        )}
      </section>

      <nav className={styles.integrationBar} aria-label="연동 기능 바로가기">
        <a href="/admin/product-intelligence"><b>상품 수집</b><small>쿠팡·Temu 기회 분석</small></a>
        <a href="/admin/china-video-lab"><b>중국 트렌드</b><small>도우인·샤오홍슈 연구</small></a>
        <a href="/admin/revenue-shorts"><b>정밀 편집</b><small>수동 통합 제작실</small></a>
        <a href="/admin/publishing"><b>게시센터</b><small>YouTube·블로그 대기열</small></a>
        <a href="/admin/connections"><b>연결상태</b><small>API·채널 진단</small></a>
      </nav>

      <section className={styles.settings}>
        <label>
          <span>예상 제휴 수수료율</span>
          <select value={commissionRate} onChange={(event) => setCommissionRate(Number(event.target.value))} disabled={busy}>
            {[1, 2, 3, 5, 7, 10, 15, 20].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
          </select>
        </label>
        <label>
          <span>영상 길이</span>
          <select value={duration} onChange={(event) => setDuration(Number(event.target.value) as 15 | 20 | 25 | 30)} disabled={busy}>
            {[15, 20, 25, 30].map((seconds) => <option key={seconds} value={seconds}>{seconds}초</option>)}
          </select>
        </label>
        <label>
          <span>AI 목소리</span>
          <select value={voicePreset} onChange={(event) => setVoicePreset(event.target.value)} disabled={busy}>
            <option value="marin">Marin · 자연스러운 여성</option>
            <option value="coral">Coral · 밝고 또렷함</option>
            <option value="cedar">Cedar · 신뢰감 있는 남성</option>
            <option value="onyx">Onyx · 낮고 단단함</option>
          </select>
        </label>
        <div className={styles.earning}>
          <span>선택 상품 주문 1건 예상 수수료</span>
          <strong>{estimatedPerOrder ? formatWon(estimatedPerOrder) : "가격 확인 필요"}</strong>
          <small>실제 수수료는 제휴센터 기준을 우선합니다.</small>
        </div>
      </section>

      <section className={styles.productSection}>
        <div className={styles.sectionTitle}>
          <div><span>STEP 01</span><h2>수익기회 상위 상품</h2></div>
          <small>조회 가능성·시각적 시연·데이터 품질·수수료 잠재력 기반</small>
        </div>
        <div className={styles.productGrid}>
          {!candidateList.length && (
            <div className={styles.inlineEmpty}>
              <strong>아직 제작 후보가 없습니다</strong>
              <span>위에 제휴링크를 붙여넣거나 상품 기회 분석센터에서 상품을 수집하세요.</span>
              <a href="/admin/product-intelligence">상품 기회 분석센터 열기</a>
            </div>
          )}
          {candidateList.map((candidate, index) => {
            const active = candidate.id === selected?.id;
            const perOrder = parsePrice(candidate.priceText) * Math.max(0, commissionRate) / 100;
            return (
              <button key={candidate.id} type="button" className={active ? styles.productActive : styles.product} onClick={() => !busy && setSelectedId(candidate.id)} disabled={busy}>
                <div className={styles.rank}>#{index + 1}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={candidate.imageUrl} alt={candidate.title} />
                <div className={styles.productBody}>
                  <div className={styles.badges}><span>{candidate.platform}</span><span>{candidate.opportunityGrade}등급</span></div>
                  <strong>{candidate.title}</strong>
                  <p>{candidate.priceText}</p>
                  <div className={styles.scores}>
                    <span>수익기회 <b>{candidate.profitOpportunityScore}</b></span>
                    <span>상품성 <b>{candidate.aiScore}</b></span>
                    <span>건당 예상 <b>{perOrder ? formatWon(perOrder) : "-"}</b></span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <section className={styles.approval}>
          <div className={styles.selectedProduct}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.imageUrl} alt={selected.title} />
            <div>
              <span>대표 선택 상품</span>
              <h2>{selected.title}</h2>
              <p>{selected.description || "상품 상세정보를 바탕으로 과장 없는 쇼핑 쇼츠를 제작합니다."}</p>
              <div><b>{selected.priceText}</b><em>수익기회 {selected.profitOpportunityScore}점</em></div>
            </div>
          </div>
          <button className={styles.startButton} onClick={() => void startAutomation()} disabled={busy}>
            {busy ? "Dream Y 자동 제작 진행 중" : "대표 승인 · 자동 창작 시작"}
          </button>
          <small>버튼을 누르면 이미지·음성·Runway 비용 사용 동의를 한 번 더 확인합니다. 중국 원본 영상은 최종본에 사용하지 않습니다.</small>
        </section>
      )}

      <section className={styles.progressPanel}>
        <div className={styles.sectionTitle}>
          <div><span>STEP 02</span><h2>자동 제작 진행표</h2></div>
          {projectId && <a href={`/admin/creative-studio-pro?project=${encodeURIComponent(projectId)}`}>프로젝트 상세 열기</a>}
        </div>
        <div className={styles.progressGrid}>
          {progress.map((item, index) => (
            <article key={item.key} className={`${styles.progressItem} ${styles[item.state]}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{item.label}</strong><small>{item.detail || (item.state === "waiting" ? "대기" : item.state === "running" ? "진행 중" : item.state === "done" ? "완료" : "오류")}</small></div>
            </article>
          ))}
        </div>
      </section>

      {finalVideoUrl && (
        <section className={styles.finalPanel}>
          <video src={finalVideoUrl} controls playsInline preload="metadata" />
          <div>
            <span>STEP 03 · FINAL APPROVAL</span>
            <h2>완성 쇼츠를 확인해주세요</h2>
            <p>영상·한국어 자막·상품 일치 여부를 확인한 뒤 비공개 배포를 승인합니다. 공개 전 통합 게시센터에서 다시 검토할 수 있습니다.</p>
            <div className={styles.finalActions}>
              <button onClick={() => void queuePrivateYouTube()} disabled={publishing || publishQueued}>
                {publishQueued ? "YouTube 비공개 대기열 등록 완료" : publishing ? "배포 대기열 등록 중" : "대표 승인 · YouTube 비공개 배포"}
              </button>
              <a href={finalVideoUrl} target="_blank" rel="noreferrer">완성 MP4 열기</a>
              <a href="/admin/publishing">통합 게시센터</a>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
