"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./ProductionEngineV34.module.css";

type Row = Record<string, any>;
type Dashboard = { runs: Row[]; candidates: Row[]; batches: Row[] };

type SavedProduct = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  affiliate_url?: string | null;
  platform?: string | null;
};

const emptyDashboard: Dashboard = { runs: [], candidates: [], batches: [] };
const variantLabels: Record<string, string> = {
  A: "문제 해결형",
  B: "시각 충격형",
  C: "비교 증명형",
};

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    planned: "기획 완료",
    plan_review: "기획 검토 필요",
    project_ready: "제작 준비",
    images_generating: "이미지 생성 중",
    images_ready: "이미지 통과",
    runway_approved: "Runway 승인",
    clips_ready: "장면 영상 완료",
    rendering: "최종 합성 중",
    quality_review: "품질검사 대기",
    quality_passed: "90점 품질 통과",
    revision_required: "수정 필요",
    approved: "대표 최종 승인",
    failed: "실패",
  };
  return labels[value] || value || "대기";
}

export default function ProductionEngineV34() {
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [runId, setRunId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
  const [savedProductId, setSavedProductId] = useState("");
  const [form, setForm] = useState({
    productName: "",
    productDescription: "",
    productImageUrl: "",
    affiliateUrl: "",
    duration: 20,
    voicePreset: "marin",
    qualityThreshold: 90,
  });
  const [hookChoice, setHookChoice] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const activeCandidate = useMemo(
    () => dashboard.candidates.find((item) => item.id === candidateId) || null,
    [dashboard.candidates, candidateId],
  );
  const batches = dashboard.batches || [];

  function patch(key: keyof typeof form, value: string | number) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function load(nextRunId = runId) {
    const query = nextRunId ? `?runId=${encodeURIComponent(nextRunId)}` : "";
    const response = await fetch(`/api/shorts-intelligence-v3/production/status${query}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "V3-4 제작현황을 불러오지 못했습니다.");
    setDashboard({ runs: data.runs || [], candidates: data.candidates || [], batches: data.batches || [] });
    if (!nextRunId && data.runs?.[0]?.id) {
      setRunId(data.runs[0].id);
      await load(data.runs[0].id);
      return;
    }
    if (nextRunId && !candidateId && data.candidates?.[0]?.id) setCandidateId(data.candidates[0].id);
  }

  async function loadProducts() {
    const response = await fetch("/api/products", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setSavedProducts(Array.isArray(data.products) ? data.products.slice(0, 100) : []);
  }

  useEffect(() => {
    void Promise.all([load(), loadProducts()]).catch((error) => setMessage(error instanceof Error ? error.message : "초기화 실패"));
    // Initial hydration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!runId) return;
    setCandidateId("");
    void load(runId).catch((error) => setMessage(error instanceof Error ? error.message : "수집 작업 전환 실패"));
    // Run changes explicitly reload candidates and batches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useEffect(() => {
    const rendering = batches.some((batch) => batch.variants?.some((variant: Row) => variant.project?.status === "rendering"));
    if (!rendering) return;
    const timer = window.setInterval(() => void load(runId).catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
    // Poll only while final rendering is active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, batches]);

  function importSavedProduct(productId: string) {
    setSavedProductId(productId);
    const product = savedProducts.find((item) => item.id === productId);
    if (!product) return;
    setForm((current) => ({
      ...current,
      productName: product.title || current.productName,
      productDescription: product.description || current.productDescription,
      productImageUrl: product.image_url || current.productImageUrl,
      affiliateUrl: product.affiliate_url || current.affiliateUrl,
    }));
    setMessage(`${product.platform || "저장"} 상품 정보를 V3-4 제작 입력란에 불러왔습니다.`);
  }

  async function requestJson(url: string, options: RequestInit = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || "작업에 실패했습니다.");
    return data;
  }

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    if (!activeCandidate) return;
    setBusy("plan"); setMessage("V3-3 분석을 바탕으로 A·B·C 한국형 쇼츠 3개를 설계하고 있습니다.");
    try {
      const data = await requestJson("/api/shorts-intelligence-v3/production/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, runId, candidateId }),
      });
      setMessage(data.message);
      await load(runId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "V3-4 기획 생성 실패");
    } finally { setBusy(""); }
  }

  async function runVariantAction(variant: Row, key: string, task: () => Promise<string>) {
    setBusy(`${variant.id}:${key}`); setMessage("");
    try {
      const result = await task();
      setMessage(result);
      await requestJson("/api/shorts-intelligence-v3/production/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: variant.id }),
      }).catch(() => undefined);
      await load(runId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "작업 실패");
    } finally { setBusy(""); }
  }

  async function approveContent(variant: Row) {
    const projectId = variant.video_project_id;
    const hookIndex = hookChoice[variant.id] ?? 0;
    await runVariantAction(variant, "content", async () => {
      const data = await requestJson(`/api/creative-studio-pro/projects/${projectId}/content-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hookIndex }),
      });
      return data.message || `${variant.variant_key}안 콘텐츠를 승인했습니다.`;
    });
  }

  async function prepareImages(variant: Row) {
    await runVariantAction(variant, "images", async () => {
      const maxSteps = Math.max(3, Number(variant.progress?.sceneCount || form.duration / 5) * 2 + 1);
      let lastMessage = "";
      for (let index = 0; index < maxSteps; index += 1) {
        const data = await requestJson(`/api/creative-studio-pro/projects/${variant.video_project_id}/prepare-next`, { method: "POST" });
        lastMessage = data.message || lastMessage;
        if (data.hold || data.done) break;
      }
      return lastMessage || "전체 장면 이미지 생성·상품 일치도 검사를 마쳤습니다.";
    });
  }

  async function approveRunway(variant: Row) {
    if (!window.confirm(`${variant.variant_key}안의 Runway 유료 장면 생성을 승인할까요? 승인 전에는 크레딧이 사용되지 않습니다.`)) return;
    await runVariantAction(variant, "runway-approval", async () => {
      const data = await requestJson(`/api/creative-studio-pro/projects/${variant.video_project_id}/approve-render`, { method: "POST" });
      return data.message || "Runway 비용을 승인했습니다.";
    });
  }

  async function generateClips(variant: Row) {
    if (!window.confirm(`${variant.variant_key}안의 남은 장면을 Runway로 생성합니다. 실제 크레딧이 사용됩니다. 계속할까요?`)) return;
    await runVariantAction(variant, "clips", async () => {
      const maxSteps = Math.max(3, Number(variant.progress?.sceneCount || form.duration / 5) + 1);
      let lastMessage = "";
      for (let index = 0; index < maxSteps; index += 1) {
        const data = await requestJson(`/api/creative-studio-pro/projects/${variant.video_project_id}/generate-next`, { method: "POST" });
        lastMessage = data.message || lastMessage;
        if (data.done) break;
      }
      return lastMessage || "Runway 장면 생성을 마쳤습니다.";
    });
  }

  async function generateVoice(variant: Row) {
    await runVariantAction(variant, "voice", async () => {
      const data = await requestJson(`/api/creative-studio-pro/projects/${variant.video_project_id}/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: form.voicePreset }),
      });
      return data.audioUrl ? "승인된 한국어 대본으로 AI 음성을 만들었습니다." : "AI 음성 생성 완료";
    });
  }

  async function renderFinal(variant: Row) {
    await runVariantAction(variant, "render", async () => {
      const data = await requestJson(`/api/creative-studio-pro/projects/${variant.video_project_id}/render`, { method: "POST" });
      return data.message || "최종 MP4 합성을 시작했습니다.";
    });
  }

  async function syncQuality(variant: Row) {
    await runVariantAction(variant, "quality", async () => {
      const data = await requestJson("/api/shorts-intelligence-v3/production/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: variant.id }),
      });
      return data.quality?.summary || "V3-4 품질점수를 갱신했습니다.";
    });
  }

  async function finalApprove(variant: Row) {
    if (!window.confirm(`${variant.variant_key}안을 최종 승인할까요? 승인 후 V3-5 성과 학습 대상으로 사용할 수 있습니다.`)) return;
    await runVariantAction(variant, "final", async () => {
      const data = await requestJson("/api/shorts-intelligence-v3/production/final-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: variant.id }),
      });
      return data.message || "대표 최종 승인 완료";
    });
  }

  function isBusy(variant: Row, key?: string) {
    return key ? busy === `${variant.id}:${key}` : busy.startsWith(`${variant.id}:`);
  }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span>GY-NEXUS V3-4</span><h1>AI Shorts Production Engine</h1><p>V3-3 장면 지능을 새로운 한국형 A·B·C 쇼츠로 바꾸고, 상품 이미지 검수·Runway·한국어 TTS·정확한 자막·최종 MP4·90점 품질 차단까지 관리합니다.</p></div>
      <nav><a href="/admin/shorts-intelligence-v3">V3 대시보드</a><a href="/admin/shorts-intelligence-v3/scene-intelligence">V3-3 장면분석</a><button onClick={() => void load(runId)}>새로고침</button></nav>
    </header>

    {message && <div className={styles.message}>{message}</div>}

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 1</span><h2>상품과 V3-3 분석 선택</h2></div><small>원본 중국 영상은 사용하지 않고 분석 구조만 재창작</small></div>
      <div className={styles.sourceGrid}>
        <label>V3-2 수집 작업<select value={runId} onChange={(event: any) => setRunId(event.target.value)}><option value="">작업 선택</option>{dashboard.runs.map((run) => <option key={run.id} value={run.id}>{run.query} · {run.collected_candidate_count || 0}개</option>)}</select></label>
        <label>V3-3 완료 후보<select value={candidateId} onChange={(event: any) => setCandidateId(event.target.value)}><option value="">분석 후보 선택</option>{dashboard.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>#{candidate.scene_analysis_rank || "-"} {candidate.title} · {candidate.scene_analysis_score || 0}점</option>)}</select></label>
        <label>저장 상품 불러오기<select value={savedProductId} onChange={(event: any) => importSavedProduct(event.target.value)}><option value="">상품 선택</option>{savedProducts.map((product) => <option key={product.id} value={product.id}>{product.platform || "기타"} · {product.title}</option>)}</select></label>
      </div>
      {activeCandidate && <div className={styles.candidate}><div className={styles.candidateThumb}>{activeCandidate.thumbnail_url ? <img src={activeCandidate.thumbnail_url} alt="" /> : <b>{activeCandidate.platform}</b>}</div><div><b>{activeCandidate.title}</b><p>{activeCandidate.scene_analysis_summary || "Gemini 장면분석 완료"}</p></div><strong>{activeCandidate.scene_analysis_score || 0}점</strong></div>}
    </section>

    <form className={styles.panel} onSubmit={createPlan}>
      <div className={styles.panelHead}><div><span>STEP 2</span><h2>A·B·C 실제 제작 프로젝트 생성</h2></div><small>여기까지는 Runway 크레딧을 사용하지 않음</small></div>
      <div className={styles.formGrid}>
        <label>상품명<input value={form.productName} onChange={(event: any) => patch("productName", event.target.value)} required minLength={2} /></label>
        <label>실제 상품 이미지 HTTPS 주소<input value={form.productImageUrl} onChange={(event: any) => patch("productImageUrl", event.target.value)} required placeholder="https://..." /></label>
        <label className={styles.wide}>확인된 상품 설명<textarea value={form.productDescription} onChange={(event: any) => patch("productDescription", event.target.value)} required minLength={10} placeholder="상세페이지에서 확인된 재질·크기·구성·사용법만 입력" /></label>
        <label>제휴 링크<input value={form.affiliateUrl} onChange={(event: any) => patch("affiliateUrl", event.target.value)} placeholder="https://..." /></label>
        <label>영상 길이<select value={form.duration} onChange={(event: any) => patch("duration", Number(event.target.value))}>{[15,20,25,30].map((value) => <option key={value} value={value}>{value}초</option>)}</select></label>
        <label>한국어 음성<select value={form.voicePreset} onChange={(event: any) => patch("voicePreset", event.target.value)}><option value="marin">여성 · 자연스러운 Marin</option><option value="coral">여성 · 밝은 Coral</option><option value="shimmer">여성 · 부드러운 Shimmer</option><option value="cedar">남성 · 신뢰감 Cedar</option><option value="onyx">남성 · 묵직한 Onyx</option><option value="echo">남성 · 선명한 Echo</option></select></label>
        <label>최종 품질 기준<select value={form.qualityThreshold} onChange={(event: any) => patch("qualityThreshold", Number(event.target.value))}>{[88,90,92,95].map((value) => <option key={value} value={value}>{value}점</option>)}</select></label>
      </div>
      <button className={styles.primary} disabled={busy === "plan" || !candidateId}>{busy === "plan" ? "3개 제작실 만드는 중" : "A·B·C 쇼츠 3개 제작 준비"}</button>
    </form>

    <section className={styles.production}>
      <div className={styles.sectionTitle}><span>PRODUCTION BOARD</span><h2>V3-4 제작 진행판</h2><p>콘텐츠 승인과 Runway 비용 승인은 대표님이 직접 결정하며, 나머지는 단계별 자동 실행합니다.</p></div>
      {batches.map((batch) => <article className={styles.batch} key={batch.id}>
        <header><div><b>{batch.product_name}</b><span>{batch.duration_seconds}초 · 기준 {batch.quality_threshold}점 · {new Date(batch.created_at).toLocaleString("ko-KR")}</span></div><i>{statusLabel(batch.status)}</i></header>
        <div className={styles.variantGrid}>{(batch.variants || []).map((variant: Row) => {
          const project = variant.project || {};
          const progress = variant.progress || { sceneCount: 0, imageApproved: 0, clipsCompleted: 0 };
          const commerce = project.commercePackage || variant.plan || {};
          const hooks = commerce.hookOptions || variant.plan?.hookOptions || [];
          const contentApproved = Boolean(project.contentApprovedAt);
          const imagesReady = progress.sceneCount > 0 && progress.imageApproved === progress.sceneCount;
          const clipsReady = progress.sceneCount > 0 && progress.clipsCompleted === progress.sceneCount;
          const voiceReady = Boolean(project.voiceAudioUrl);
          const finalReady = Boolean(project.finalVideoUrl || variant.final_video_url);
          return <section className={styles.variant} key={variant.id}>
            <div className={styles.variantHead}><span>{variant.variant_key}</span><div><h3>{variantLabels[variant.variant_key]}</h3><p>{variant.title}</p></div><strong>{variant.final_score || variant.plan_score || 0}점</strong></div>
            <p className={styles.strategy}>{variant.strategy_summary}</p>
            <div className={styles.progress}><span>이미지 {progress.imageApproved}/{progress.sceneCount}</span><span>영상 {progress.clipsCompleted}/{progress.sceneCount}</span><span>음성 {voiceReady ? "완료" : "대기"}</span><span>MP4 {finalReady ? "완료" : "대기"}</span></div>
            <label className={styles.hookSelect}>첫 3초 훅<select value={hookChoice[variant.id] ?? 0} onChange={(event: any) => setHookChoice((current) => ({ ...current, [variant.id]: Number(event.target.value) }))}>{hooks.slice(0,3).map((hook: string, index: number) => <option key={`${variant.id}-${index}`} value={index}>{index + 1}. {hook}</option>)}</select></label>
            <div className={styles.actions}>
              <button onClick={() => void approveContent(variant)} disabled={isBusy(variant) || contentApproved}>{contentApproved ? "콘텐츠 승인됨" : "1. 훅·대본 대표 승인"}</button>
              <button onClick={() => void prepareImages(variant)} disabled={isBusy(variant) || !contentApproved || imagesReady}>{imagesReady ? "이미지 통과" : "2. 이미지 생성·검수"}</button>
              <button onClick={() => void approveRunway(variant)} disabled={isBusy(variant) || !imagesReady || project.renderApproved}>{project.renderApproved ? "Runway 승인됨" : "3. Runway 비용 승인"}</button>
              <button onClick={() => void generateClips(variant)} disabled={isBusy(variant) || !project.renderApproved || clipsReady}>{clipsReady ? "장면 영상 완료" : "4. Runway 장면 생성"}</button>
              <button onClick={() => void generateVoice(variant)} disabled={isBusy(variant) || !contentApproved || voiceReady}>{voiceReady ? "한국어 음성 완료" : "5. 한국어 TTS"}</button>
              <button onClick={() => void renderFinal(variant)} disabled={isBusy(variant) || !clipsReady || !voiceReady || ["rendering", "completed"].includes(project.status)}>{project.status === "rendering" ? "합성 중" : finalReady ? "MP4 완료" : "6. 최종 MP4 합성"}</button>
              <button onClick={() => void syncQuality(variant)} disabled={isBusy(variant)}>7. 90점 품질검사</button>
              <button className={styles.approve} onClick={() => void finalApprove(variant)} disabled={isBusy(variant) || variant.status !== "quality_passed"}>{variant.status === "approved" ? "대표 승인 완료" : "8. 대표 최종 승인"}</button>
            </div>
            {isBusy(variant) && <div className={styles.busy}>작업 중입니다. 창을 닫지 마세요.</div>}
            {variant.quality_report?.criticalErrors?.length > 0 && <div className={styles.issues}>{variant.quality_report.criticalErrors.map((issue: string) => <span key={issue}>{issue}</span>)}</div>}
            <footer><b>{statusLabel(variant.status)}</b><div>{project.finalVideoUrl && <a href={project.finalVideoUrl} target="_blank" rel="noreferrer">완성 MP4 보기</a>}{contentApproved && variant.video_project_id && <a href={`/api/shorts-intelligence-v3/production/export?variantId=${encodeURIComponent(variant.id)}`}>SRT 받기</a>}<a href="/admin/creative-studio-pro">세부 편집실</a></div></footer>
          </section>;
        })}</div>
      </article>)}
      {!batches.length && <div className={styles.empty}>아직 V3-4 제작 묶음이 없습니다. 상품과 V3-3 후보를 선택해 A·B·C 제작 준비를 시작하세요.</div>}
    </section>
  </main>;
}
