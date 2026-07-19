"use client";

import { useEffect, useMemo, useState } from "react";

type Project = {
  id: string;
  title: string;
  product_name: string;
  product_description?: string;
  source_image_url?: string | null;
  duration_seconds: number;
  ratio: string;
  style: string;
  status: string;
  render_approved?: boolean;
  quality_threshold?: number;
  final_video_url?: string | null;
  settings?: {
    sourceMode?: "single-photo-commerce" | "premium-multi-photo";
    referenceImageUrls?: string[];
    affiliateUrl?: string;
    subtitleStyle?: string;
    thumbnailStyle?: string;
    sfxMode?: string;
    commercePackage?: CommercePackage;
    voiceAudioUrl?: string;
    voiceName?: string;
    visualProfile?: {
      identitySummary?: string;
      referenceCoverageScore?: number;
      referenceGaps?: string[];
      forbiddenChanges?: string[];
    };
  } | null;
  created_at: string;
};

type CommercePackage = {
  title: string;
  hookOptions: string[];
  voiceover: string;
  description: string;
  hashtags: string[];
  disclosure: string;
  cta: string;
  thumbnailOptions: Array<{
    headline: string;
    accent: string;
    layout: "benefit-arrow" | "problem-solution" | "clean-product";
  }>;
  verifiedClaims: string[];
  cautions: string[];
};

type QualityMetrics = {
  productMatch: number;
  visualIntegrity: number;
  geometryDetail?: number;
  colorMaterial?: number;
  textLogoIntegrity?: number;
  humanAnatomy?: number;
  sceneContinuity?: number;
  motionReadiness?: number;
  commercialNaturalness: number;
  composition: number;
  claimSafety: number;
};

type QualityReport = {
  score?: number;
  threshold?: number;
  summary?: string;
  issues?: string[];
  metrics?: QualityMetrics;
  criticalErrors?: string[];
};

type ImageCandidate = {
  index: number;
  assetUrl: string;
  score?: number;
  issues?: string[];
};

type Scene = {
  id: string;
  scene_number: number;
  start_second: number;
  end_second: number;
  role: string;
  prompt: string;
  subtitle_text: string;
  narration: string;
  status: string;
  quality_status?: string;
  quality_score?: number | null;
  quality_report?: QualityReport | null;
  image_candidates?: ImageCandidate[] | null;
  selected_image_url?: string | null;
  image_retry_count?: number;
  video_url?: string | null;
  error_message?: string | null;
};

type BusyState = "create" | "package" | "voice" | "image" | "images" | "approve" | "scene" | "all" | "render" | null;

const styles = [
  ["cinematic-product", "영화형 상품 광고"],
  ["emotional-brand", "감성 브랜드"],
  ["how-to", "사용법 설명"],
  ["ugc-review", "후기형 UGC"],
  ["problem-solution", "문제 해결형"],
];

const qualityLabels: Record<string, string> = {
  pending: "검수 대기",
  generating: "후보 생성 중",
  reviewing: "AI 검수 중",
  approved: "품질 통과",
  revision_required: "자동 재생성",
  hold: "대표님 확인 필요",
  failed: "검수 실패",
};

export default function CreativeStudioPro() {
  const [form, setForm] = useState({
    title: "GY-NEXUS 20초 상품 영상",
    productUrl: "",
    affiliateUrl: "",
    productName: "",
    productDescription: "",
    masterPrompt: "첫 2초는 강한 시각적 훅, 실제 사용 장면 중심, 과장 없는 프리미엄 광고",
    sourceMode: "single-photo-commerce",
    sourceImageUrl: "",
    duration: 20,
    ratio: "720:1280",
    style: "cinematic-product",
    subtitleMode: "korean",
    voiceMode: "female",
    musicMood: "modern-corporate",
    subtitleStyle: "bold-pop",
    thumbnailStyle: "benefit-arrow",
    sfxMode: "recommended",
    platformTargets: ["youtube", "instagram"],
    qualityThreshold: 85,
    maxImageRetries: 2,
  });
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const previewUrls = useMemo(() => referenceFiles.map((file) => URL.createObjectURL(file)), [referenceFiles]);
  useEffect(() => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)), [previewUrls]);

  const imageApproved = scenes.filter((scene) => scene.quality_status === "approved").length;
  const qualityHolds = scenes.filter((scene) => scene.quality_status === "hold").length;
  const completed = scenes.filter((scene) => scene.status === "completed").length;
  const imageProgress = scenes.length ? Math.round((imageApproved / scenes.length) * 100) : 0;
  const videoProgress = scenes.length ? Math.round((completed / scenes.length) * 100) : 0;
  const visualProfile = selected?.settings?.visualProfile;
  const commercePackage = selected?.settings?.commercePackage;
  const singlePhotoMode = form.sourceMode === "single-photo-commerce";
  const productPreviewUrl = selected?.settings?.referenceImageUrls?.[0] || selected?.source_image_url || "";

  async function loadProjects() {
    const response = await fetch("/api/creative-studio-pro/projects", { cache: "no-store" });
    const data = await response.json();
    if (data.success) setProjects(data.projects);
  }

  async function openProject(project: Pick<Project, "id">) {
    setError("");
    const response = await fetch(`/api/creative-studio-pro/projects/${project.id}`, { cache: "no-store" });
    const data = await response.json();
    if (data.success) {
      setSelected(data.project);
      setScenes(data.scenes);
    } else {
      setError(data.message);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  function patch(key: string, value: string | number) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectReferences(files: FileList | null) {
    const next = Array.from(files || []);
    if (next.length > 4) {
      setError("상품 사진은 최대 4장까지 선택할 수 있습니다.");
      return;
    }
    setError("");
    setReferenceFiles(next);
  }

  async function uploadReferences() {
    if (!referenceFiles.length) return [] as string[];
    const payload = new FormData();
    referenceFiles.forEach((file) => payload.append("images", file));
    const response = await fetch("/api/creative-studio-pro/references", { method: "POST", body: payload });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "상품 사진 업로드 실패");
    return data.urls as string[];
  }

  async function createProject() {
    const referenceCount = referenceFiles.length + (form.sourceImageUrl.trim() ? 1 : 0);
    const minimumReferences = singlePhotoMode ? 1 : 2;
    if (referenceCount < minimumReferences) {
      setError(singlePhotoMode
        ? "사진 한 장 쇼츠를 만들려면 실제 상품 이미지 1장을 올려주세요."
        : "유료 품질 기준을 위해 실제 상품 사진을 앞·뒤 또는 서로 다른 각도로 최소 2장 올려주세요.");
      return;
    }
    setBusy("create");
    setError("");
    setMessage("");
    try {
      const uploadedUrls = await uploadReferences();
      const response = await fetch("/api/creative-studio-pro/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, referenceImageUrls: uploadedUrls }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setMessage(`${data.scenes.length}개 장면 기획이 완료되었습니다. 아직 Runway 비용은 사용하지 않았습니다.`);
      await loadProjects();
      await openProject(data.project);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로젝트 생성 실패");
    } finally {
      setBusy(null);
    }
  }

  async function generatePackage() {
    if (!selected) return;
    setBusy("package");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/commerce-package`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      setMessage("한국형 대본·훅 3개·썸네일 문구·제목·설명·태그를 만들었습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "쇼핑 콘텐츠 패키지 생성 실패");
    } finally {
      setBusy(null);
    }
  }

  async function generateVoice() {
    if (!selected) return;
    setBusy("voice");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      setMessage("검수된 한국어 대본으로 AI 음성을 만들었습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 음성 생성 실패");
    } finally {
      setBusy(null);
    }
  }

  async function prepareNext(silent = false) {
    if (!selected) return { done: true, readyForRunway: false };
    if (!silent) {
      setBusy("image");
      setError("");
      setMessage("");
    }
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/prepare-next`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      if (!silent) setMessage(data.message);
      return { done: Boolean(data.done), readyForRunway: Boolean(data.readyForRunway) };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "이미지 생성·검수 실패");
      return { done: true, readyForRunway: false };
    } finally {
      if (!silent) setBusy(null);
    }
  }

  async function prepareAll() {
    if (!selected) return;
    const confirmed = window.confirm(
      `장면마다 중간 품질 후보 3개를 비교하고 통과 시 4K 고품질 최종본을 생성합니다. 상품 정체성과 장면 연속성을 검사하며 최대 ${form.maxImageRetries}회까지 자동 재생성할 수 있습니다. 계속할까요?`,
    );
    if (!confirmed) return;
    setBusy("images");
    setError("");
    setMessage("후보 이미지 생성과 상품 일치도 검수를 순서대로 진행합니다. 창을 닫지 마세요.");
    for (let index = 0; index < scenes.length * 2 + 1; index += 1) {
      const result = await prepareNext(true);
      if (result.done) break;
    }
    await openProject(selected);
    setBusy(null);
    setMessage("전체 이미지 검수를 마쳤습니다. 보류 장면이 없다면 Runway 비용 승인을 할 수 있습니다.");
  }

  async function approveRunway() {
    if (!selected) return;
    const confirmed = window.confirm(
      `품질을 통과한 ${scenes.length}개 장면을 Runway 영상으로 만들 수 있게 승인합니다. 이 승인 뒤 영상 생성 버튼을 누르면 Runway 크레딧이 사용됩니다. 승인할까요?`,
    );
    if (!confirmed) return;
    setBusy("approve");
    setError("");
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/approve-render`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      await loadProjects();
      setMessage("Runway 사용을 승인했습니다. 이제 장면 영상을 생성할 수 있습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Runway 승인 실패");
    } finally {
      setBusy(null);
    }
  }

  async function generateNext(silent = false) {
    if (!selected) return false;
    if (!silent) {
      setBusy("scene");
      setError("");
      setMessage("");
    }
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/generate-next`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await openProject(selected);
      if (!silent) setMessage(data.done ? "모든 Runway 장면 생성이 완료되었습니다." : "다음 장면 영상이 완료되었습니다.");
      return Boolean(data.done);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "장면 영상 생성 실패");
      return true;
    } finally {
      if (!silent) setBusy(null);
    }
  }

  async function generateAll() {
    if (!selected) return;
    const confirmed = window.confirm(`남은 ${scenes.length - completed}개 장면의 Runway 크레딧을 사용합니다. 계속할까요?`);
    if (!confirmed) return;
    setBusy("all");
    setError("");
    setMessage("Runway 영상을 장면별로 생성하고 있습니다. 창을 닫지 마세요.");
    for (let index = 0; index < scenes.length + 1; index += 1) {
      const done = await generateNext(true);
      if (done) break;
    }
    await openProject(selected);
    setBusy(null);
    setMessage("Runway 장면 일괄 생성 작업을 마쳤습니다.");
  }

  async function render() {
    if (!selected) return;
    setBusy("render");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/creative-studio-pro/projects/${selected.id}/render`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setMessage(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "렌더링 요청 실패");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="creative-pro-stack shorts-quality-studio">
      <section className="panel creative-pro-hero">
        <div>
          <div className="eyebrow">GY PHOTO COMMERCE · PREMIUM SHORTS</div>
          <h1>사진 한 장부터 프리미엄 상품 쇼츠까지 한곳에서 완성</h1>
          <p>상품 이미지를 넣으면 Dream Y가 한국형 대본·AI 음성·장면·썸네일 문구·제목·설명·태그를 만들고, 상품 형태를 검수한 장면만 영상으로 보냅니다.</p>
        </div>
        <div className="creative-pro-badge"><strong>{form.duration}초</strong><span>{form.duration / 5}개 장면</span></div>
      </section>

      <div className="creative-pro-layout">
        <section className="panel creative-pro-form">
          <div className="section-title-row"><div><span className="eyebrow">STEP 1</span><h2>상품 사실자료와 영상 설정</h2></div><span className="quality-rule">통과 기준 {form.qualityThreshold}점</span></div>
          <div className="photo-mode-grid">
            <button type="button" className={singlePhotoMode ? "active" : ""} onClick={() => patch("sourceMode", "single-photo-commerce")}>
              <strong>사진 한 장 쇼츠</strong><span>한 장의 상품은 그대로 보존하고 배경·조명·카메라 연출을 바꿉니다.</span>
            </button>
            <button type="button" className={!singlePhotoMode ? "active" : ""} onClick={() => patch("sourceMode", "premium-multi-photo")}>
              <strong>프리미엄 2~4장</strong><span>앞·뒤·측면 자료로 실제 사용형 장면과 엄격한 상품 검수를 진행합니다.</span>
            </button>
          </div>
          <div className="form-grid">
            <label>작업명<input value={form.title} onChange={(event) => patch("title", event.target.value)} /></label>
            <label>상품명<input value={form.productName} onChange={(event) => patch("productName", event.target.value)} placeholder="예: USB-C 8포트 허브" /></label>
          </div>
          <label>상품 판매 페이지 주소<input value={form.productUrl} onChange={(event) => patch("productUrl", event.target.value)} placeholder="선택사항 · 사실 확인용 URL" /></label>
          <label>제휴 링크<input value={form.affiliateUrl} onChange={(event) => patch("affiliateUrl", event.target.value)} placeholder="쿠팡·Temu에서 직접 만든 제휴 링크 · 선택사항" /></label>
          <label>검증된 상품 설명<textarea rows={4} value={form.productDescription} onChange={(event) => patch("productDescription", event.target.value)} placeholder="확인된 크기, 재질, 구성품, 기능만 입력하세요." /></label>

          <div className="reference-upload">
            <div><b>{singlePhotoMode ? "실제 상품 사진 1장 이상" : "실제 상품 사진 2~4장"}</b><span>{singlePhotoMode ? "정면이 선명하고 글자·워터마크가 적은 사진을 권장합니다." : "앞·뒤·측면·실제 사용 장면을 권장합니다."} PNG/JPG/WEBP, 장당 8MB 이하</span></div>
            <label className="upload-button">사진 선택<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => selectReferences(event.target.files)} /></label>
          </div>
          {previewUrls.length > 0 && <div className="reference-preview">{previewUrls.map((url, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt={`상품 참조 ${index + 1}`} />
          ))}</div>}
          <label>공개 상품 이미지 URL<input value={form.sourceImageUrl} onChange={(event) => patch("sourceImageUrl", event.target.value)} placeholder="파일 대신 사용할 때만 입력 · HTTPS" /></label>
          <label>공통 연출 지시<textarea rows={4} value={form.masterPrompt} onChange={(event) => patch("masterPrompt", event.target.value)} /></label>

          <div className="choice-block"><b>영상 길이</b><div className="choice-row">{[15, 20, 25, 30].map((seconds) => <button key={seconds} className={form.duration === seconds ? "selected" : ""} onClick={() => patch("duration", seconds)}>{seconds}초</button>)}</div></div>
          <div className="form-grid">
            <label>스타일<select value={form.style} onChange={(event) => patch("style", event.target.value)}>{styles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>화면 비율<select value={form.ratio} onChange={(event) => patch("ratio", event.target.value)}><option value="720:1280">9:16 쇼츠</option><option value="1280:720">16:9 유튜브</option></select></label>
            <label>품질 통과 기준<select value={form.qualityThreshold} onChange={(event) => patch("qualityThreshold", Number(event.target.value))}><option value={85}>85점 · 권장</option><option value={90}>90점 · 엄격</option><option value={95}>95점 · 매우 엄격</option></select></label>
            <label>자동 재검수 한도<select value={form.maxImageRetries} onChange={(event) => patch("maxImageRetries", Number(event.target.value))}><option value={1}>1회 · 비용 절약</option><option value={2}>2회 · 권장</option></select></label>
            <label>자막<select value={form.subtitleMode} onChange={(event) => patch("subtitleMode", event.target.value)}><option value="korean">정확한 한국어 자막</option><option value="none">자막 없음</option></select></label>
            <label>음성<select value={form.voiceMode} onChange={(event) => patch("voiceMode", event.target.value)}><option value="female">여성 내레이션</option><option value="male">남성 내레이션</option><option value="music-only">배경음악만</option><option value="silent">무음</option></select></label>
            <label>자막 스타일<select value={form.subtitleStyle} onChange={(event) => patch("subtitleStyle", event.target.value)}><option value="bold-pop">강조형 쇼핑 자막</option><option value="clean-card">깔끔한 카드 자막</option><option value="minimal">미니멀 자막</option></select></label>
            <label>썸네일 스타일<select value={form.thumbnailStyle} onChange={(event) => patch("thumbnailStyle", event.target.value)}><option value="benefit-arrow">혜택 강조＋화살표</option><option value="problem-solution">문제 해결형</option><option value="clean-product">상품 중심형</option></select></label>
            <label>효과음<select value={form.sfxMode} onChange={(event) => patch("sfxMode", event.target.value)}><option value="recommended">장면별 추천 효과음</option><option value="minimal">최소 효과음</option><option value="none">효과음 없음</option></select></label>
          </div>
          <div className="cost-note"><b>비용 안전장치</b><span>프로젝트 생성은 장면 기획만 합니다. 이미지 생성은 별도 버튼, Runway는 전체 이미지 통과 후 대표님이 직접 승인해야 시작됩니다.</span></div>
          <button className="button button-primary" onClick={createProject} disabled={Boolean(busy)}>{busy === "create" ? "상품 사진 업로드·기획 중..." : "장면 기획 프로젝트 만들기"}</button>
          {message && <p className="success-text">{message}</p>}
          {error && <p className="error-text">{error}</p>}
        </section>

        <section className="panel creative-pro-projects">
          <h2>최근 프로젝트</h2>
          {projects.length === 0 ? <p className="empty-state">아직 프로젝트가 없습니다.</p> : projects.map((project) => (
            <button key={project.id} onClick={() => openProject(project)} className={selected?.id === project.id ? "project-item active" : "project-item"}>
              <span><b>{project.title}</b><small>{project.product_name} · {project.duration_seconds}초</small></span>
              <em>{project.render_approved ? "Runway 승인" : project.status}</em>
            </button>
          ))}
        </section>
      </div>

      {selected && <section className="panel creative-pro-timeline">
        <div className="timeline-head">
          <div><span className="eyebrow">STEP 2–4 · PROJECT</span><h2>{selected.title}</h2><p>이미지 {imageApproved}/{scenes.length} 통과 · 영상 {completed}/{scenes.length} 완료</p></div>
          <div className="timeline-actions quality-actions">
            <button onClick={() => prepareNext()} disabled={Boolean(busy) || imageApproved === scenes.length}>{busy === "image" ? "생성·검수 중..." : "다음 이미지 생성·검수"}</button>
            <button onClick={prepareAll} disabled={Boolean(busy) || imageApproved === scenes.length}>{busy === "images" ? "전체 검수 중..." : "전체 이미지 검수"}</button>
            <button className="approve" onClick={approveRunway} disabled={Boolean(busy) || imageApproved !== scenes.length || Boolean(selected.render_approved)}>{selected.render_approved ? "Runway 승인됨" : busy === "approve" ? "승인 중..." : "Runway 비용 승인"}</button>
            <button onClick={() => generateNext()} disabled={Boolean(busy) || !selected.render_approved || completed === scenes.length}>{busy === "scene" ? "영상 생성 중..." : "다음 영상 생성"}</button>
            <button onClick={generateAll} disabled={Boolean(busy) || !selected.render_approved || completed === scenes.length}>{busy === "all" ? "전체 영상 생성 중..." : "남은 영상 모두 생성"}</button>
            <button className="render" onClick={render} disabled={Boolean(busy) || completed !== scenes.length}>{busy === "render" ? "요청 중..." : "최종 MP4 합성"}</button>
          </div>
        </div>

        <div className="dual-progress">
          <div><span><b>상품 이미지 품질검수</b><em>{imageProgress}%</em></span><div className="progress-track"><i style={{ width: `${imageProgress}%` }} /></div></div>
          <div><span><b>Runway 영상 제작</b><em>{videoProgress}%</em></span><div className="progress-track video"><i style={{ width: `${videoProgress}%` }} /></div></div>
        </div>
        {visualProfile && <div className="visual-profile-card">
          <div><span className="eyebrow">PRODUCT VISUAL DNA</span><b>{visualProfile.identitySummary || selected.product_name}</b></div>
          <strong>{visualProfile.referenceCoverageScore ?? "-"}점</strong>
          {Array.isArray(visualProfile.referenceGaps) && visualProfile.referenceGaps.length > 0 && <p>보완 자료: {visualProfile.referenceGaps.join(" · ")}</p>}
          {Array.isArray(visualProfile.forbiddenChanges) && visualProfile.forbiddenChanges.length > 0 && <p>변경 금지: {visualProfile.forbiddenChanges.join(" · ")}</p>}
        </div>}
        {qualityHolds > 0 && <p className="quality-hold-note">{qualityHolds}개 장면이 상품 일치도 기준에 미달해 보류되었습니다. Runway 비용은 사용되지 않았습니다.</p>}

        <section className="commerce-package-panel">
          <div className="commerce-package-head">
            <div><span className="eyebrow">ONE IMAGE → SALES PACKAGE</span><h3>한국형 대본·음성·썸네일·게시정보</h3><p>사진을 다시 올릴 필요 없이 이 프로젝트의 상품 사실자료로 판매 패키지를 만듭니다.</p></div>
            <div className="commerce-package-actions">
              <button onClick={generatePackage} disabled={Boolean(busy)}>{busy === "package" ? "대본·메타데이터 생성 중..." : commercePackage ? "판매 패키지 다시 생성" : "판매 패키지 생성"}</button>
              <button onClick={generateVoice} disabled={Boolean(busy) || !commercePackage}>{busy === "voice" ? "한국어 음성 생성 중..." : "AI 음성 만들기"}</button>
            </div>
          </div>
          {commercePackage ? <div className="commerce-package-grid">
            <article className="commerce-copy-card">
              <span>추천 제목</span><h4>{commercePackage.title}</h4>
              <b>첫 2초 훅 3개</b>
              <ol>{commercePackage.hookOptions.map((hook) => <li key={hook}>{hook}</li>)}</ol>
              <b>완성 대본</b><p>{commercePackage.voiceover}</p>
              <b>CTA</b><p>{commercePackage.cta}</p>
            </article>
            <article className="commerce-thumbnail-card">
              <span>정확한 글자로 만드는 썸네일 3안</span>
              <div className="thumbnail-option-list">{commercePackage.thumbnailOptions.map((thumbnail, index) => <div key={`${thumbnail.headline}-${index}`} className={`thumbnail-option ${thumbnail.layout}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {productPreviewUrl && <img src={productPreviewUrl} alt="상품 썸네일 참고" />}
                <div><strong>{thumbnail.headline}</strong><em>{thumbnail.accent}</em></div>
                {thumbnail.layout === "benefit-arrow" && <i>➜</i>}
              </div>)}</div>
            </article>
            <article className="commerce-meta-card">
              <span>게시 설명·태그</span><p>{commercePackage.description}</p>
              <div className="commerce-tags">{commercePackage.hashtags.map((tag) => <em key={tag}>{tag}</em>)}</div>
              <b>제휴 고지</b><p>{commercePackage.disclosure}</p>
              {commercePackage.verifiedClaims.length > 0 && <><b>확인된 표현</b><ul>{commercePackage.verifiedClaims.map((claim) => <li key={claim}>{claim}</li>)}</ul></>}
              {commercePackage.cautions.length > 0 && <><b>게시 전 확인</b><ul>{commercePackage.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul></>}
            </article>
          </div> : <p className="empty-commerce-package">`판매 패키지 생성`을 누르면 영상 속 기능처럼 훅·대본·썸네일·설명·태그가 한 번에 만들어집니다.</p>}
          {selected.settings?.voiceAudioUrl && <div className="voice-preview"><b>AI 한국어 음성 · {selected.settings.voiceName || "기본 음성"}</b><audio src={selected.settings.voiceAudioUrl} controls /></div>}
        </section>

        <div className="export-bar"><div><b>CapCut·게시 편집 자료</b><span>정확한 자막, 장면 순서와 판매 문구를 내려받습니다.</span></div><a href={`/api/creative-studio-pro/projects/${selected.id}/export?format=srt`}>SRT 자막</a><a href={`/api/creative-studio-pro/projects/${selected.id}/export?format=guide`}>CapCut 안내서</a><a href={`/api/creative-studio-pro/projects/${selected.id}/export?format=package`}>게시 패키지</a><a href={`/api/creative-studio-pro/projects/${selected.id}/export`}>편집 JSON</a></div>

        <div className="scene-grid quality-scene-grid">{scenes.map((scene) => {
          const report = scene.quality_report;
          return <article key={scene.id} className={`scene-card ${scene.status} quality-${scene.quality_status || "pending"}`}>
            <div className="scene-number">{scene.scene_number}</div>
            <div className="scene-body">
              <div className="scene-heading"><b>{scene.start_second}–{scene.end_second}초 · {scene.role}</b><span className={`quality-chip ${scene.quality_status || "pending"}`}>{qualityLabels[scene.quality_status || "pending"] || scene.quality_status}</span></div>
              <p className="exact-subtitle">{scene.subtitle_text || "자막 없음"}</p>
              {scene.selected_image_url && <div className="selected-scene-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scene.selected_image_url} alt={`장면 ${scene.scene_number} 최종 이미지`} />
                <span>{scene.quality_score ?? report?.score ?? "-"}점 · 최종본</span>
              </div>}
              {!scene.selected_image_url && Array.isArray(scene.image_candidates) && scene.image_candidates.length > 0 && <div className="candidate-strip">{scene.image_candidates.map((candidate) => (
                <div key={`${scene.id}-${candidate.index}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={candidate.assetUrl} alt={`장면 ${scene.scene_number} 후보 ${candidate.index + 1}`} />
                  <small>{candidate.score ?? "-"}점</small>
                </div>
              ))}</div>}
              {report?.metrics && <div className="quality-metrics"><span>상품 {report.metrics.productMatch}</span><span>전체 무결성 {report.metrics.visualIntegrity}</span><span>형태·버튼 {report.metrics.geometryDetail ?? "-"}</span><span>색상·재질 {report.metrics.colorMaterial ?? "-"}</span><span>로고·글자 {report.metrics.textLogoIntegrity ?? "-"}</span><span>손·신체 {report.metrics.humanAnatomy ?? "-"}</span><span>장면 연속성 {report.metrics.sceneContinuity ?? "-"}</span><span>영상 안정성 {report.metrics.motionReadiness ?? "-"}</span><span>자연스러움 {report.metrics.commercialNaturalness}</span><span>구도 {report.metrics.composition}</span><span>과장검수 {report.metrics.claimSafety}</span></div>}
              {Array.isArray(report?.criticalErrors) && report.criticalErrors.length > 0 && <p className="critical-error">치명적 오류: {report.criticalErrors.join(" · ")}</p>}
              {report?.summary && <p className="quality-summary">{report.summary}</p>}
              {Array.isArray(report?.issues) && report.issues.length > 0 && <ul className="quality-issues">{report.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
              <details><summary>장면 프롬프트·내레이션</summary><small>{scene.prompt}</small><small>{scene.narration}</small></details>
              {scene.error_message && <p className="error-text">{scene.error_message}</p>}
              {scene.video_url && <video src={scene.video_url} controls playsInline />}
            </div>
            <span className="scene-status">{scene.status}</span>
          </article>;
        })}</div>

        {selected.final_video_url && <div className="final-preview"><h3>최종 완성 영상</h3><video src={selected.final_video_url} controls playsInline /><a className="button button-primary" href={selected.final_video_url} target="_blank" rel="noreferrer">원본 열기</a></div>}
      </section>}
    </div>
  );
}
