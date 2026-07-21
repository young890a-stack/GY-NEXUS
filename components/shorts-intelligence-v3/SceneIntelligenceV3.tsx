"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./SceneIntelligenceV3.module.css";

type Row = Record<string, any>;
const rightsOptions = [
  ["owned", "직접 촬영"],
  ["seller-provided", "판매자 제공"],
  ["affiliate-provided", "제휴센터 제공"],
  ["permission-confirmed", "사용 허가 확인"],
];

export default function SceneIntelligenceV3() {
  const [runs, setRuns] = useState<Row[]>([]);
  const [runId, setRunId] = useState("");
  const [jobs, setJobs] = useState<Row[]>([]);
  const [segments, setSegments] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [rightsStatus, setRightsStatus] = useState("owned");
  const [rightsEvidence, setRightsEvidence] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [manualPrompt, setManualPrompt] = useState("");
  const [manualJson, setManualJson] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => jobs.find((item) => item.candidate_id === selectedId) || jobs[0] || null, [jobs, selectedId]);
  const selectedSegments = useMemo(() => segments.filter((item) => item.job_id === selected?.id), [segments, selected]);

  async function loadRuns() {
    const response = await fetch("/api/shorts-intelligence-v3/discovery-runs", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "수집 작업을 불러오지 못했습니다.");
    setRuns(data.runs || []);
    if (!runId && data.runs?.[0]?.id) setRunId(data.runs[0].id);
  }

  async function loadStatus(nextRunId = runId) {
    if (!nextRunId) return;
    const response = await fetch(`/api/shorts-intelligence-v3/scene-intelligence/status?runId=${encodeURIComponent(nextRunId)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "장면 분석 상태를 불러오지 못했습니다.");
    setJobs(data.jobs || []);
    setSegments(data.segments || []);
    if (!selectedId && data.jobs?.[0]?.candidate_id) setSelectedId(data.jobs[0].candidate_id);
  }

  useEffect(() => { void loadRuns().catch((error) => setMessage(error.message)); }, []);
  useEffect(() => { if (runId) void loadStatus(runId).catch((error) => setMessage(error.message)); }, [runId]);

  async function action(url: string, body: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "작업 실패");
      return data;
    } finally { setBusy(false); }
  }

  async function selectTop() {
    try {
      const data = await action("/api/shorts-intelligence-v3/scene-intelligence/select-top", { runId, limit: 30 });
      setMessage(`상위 ${data.selected}개를 V3-3 장면 분석 대상으로 선별했습니다.`);
      await loadStatus();
    } catch (error) { setMessage(error instanceof Error ? error.message : "선별 실패"); }
  }

  async function requestFrames() {
    if (!selected) return;
    try {
      await action("/api/shorts-intelligence-v3/scene-intelligence/frames/request", { candidateId: selected.candidate_id, sourceUrl, rightsStatus, rightsEvidence, sampleCount: 12 });
      setMessage("Render Worker가 권리 확인 영상을 저장하고 대표 프레임 12장을 추출하고 있습니다.");
      setSourceUrl("");
      setTimeout(() => void loadStatus(), 2500);
    } catch (error) { setMessage(error instanceof Error ? error.message : "프레임 요청 실패"); }
  }

  async function uploadVideo() {
    if (!selected || !file) return;
    setBusy(true); setMessage("");
    try {
      const form = new FormData();
      form.set("video", file); form.set("candidateId", selected.candidate_id); form.set("rightsStatus", rightsStatus); form.set("rightsEvidence", rightsEvidence);
      const response = await fetch("/api/shorts-intelligence-v3/scene-intelligence/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "업로드 실패");
      setMessage(data.message || "영상 업로드 완료"); setFile(null); await loadStatus();
    } catch (error) { setMessage(error instanceof Error ? error.message : "업로드 실패"); }
    finally { setBusy(false); }
  }

  async function analyze(mode: "auto" | "manual-export") {
    if (!selected) return;
    try {
      const data = await action("/api/shorts-intelligence-v3/scene-intelligence/analyze", { candidateId: selected.candidate_id, mode });
      if (mode === "manual-export") { setManualPrompt(data.prompt || ""); setMessage("Gemini Pro에 권리 확인 영상과 아래 프롬프트를 함께 넣어주세요."); }
      else { setMessage(`Gemini 장면 정밀분석 완료: ${data.score}점`); await loadStatus(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "분석 실패"); }
  }

  async function importManual() {
    if (!selected) return;
    try {
      const result = JSON.parse(manualJson);
      const data = await action("/api/shorts-intelligence-v3/scene-intelligence/analyze", { candidateId: selected.candidate_id, mode: "manual-import", result });
      setMessage(`Gemini Pro 분석 저장 완료: ${data.score}점`); setManualJson(""); await loadStatus();
    } catch (error) { setMessage(error instanceof Error ? error.message : "JSON 형식을 확인해주세요."); }
  }

  async function copy(value: string) { await navigator.clipboard.writeText(value); setMessage("클립보드에 복사했습니다."); }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span>GY-NEXUS V3-3</span><h1>Gemini Multimodal Scene Intelligence</h1><p>상위 30개 권리 확인 영상의 원본 저장, 대표 프레임 추출, 타임스탬프 장면 분석과 한국형 재창작 설계를 관리합니다.</p></div>
      <div className={styles.topActions}><a href="/admin/shorts-intelligence-v3">V3 대시보드</a><a href="/admin/shorts-intelligence-v3/production">V3-4 제작 엔진</a><button onClick={() => void loadStatus()} disabled={!runId || busy}>새로고침</button></div>
    </header>
    {message && <div className={styles.message}>{message}</div>}

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 1</span><h2>상위 30개 선별</h2></div><small>V3-2 수집·Gemini 1차점수 기준</small></div>
      <div className={styles.row}><select value={runId} onChange={(event) => { setRunId(event.target.value); setSelectedId(""); }}><option value="">수집 작업 선택</option>{runs.map((run) => <option key={run.id} value={run.id}>{run.query} · {run.collected_candidate_count || 0}개</option>)}</select><button onClick={() => void selectTop()} disabled={!runId || busy}>상위 30개 장면분석 선별</button></div>
    </section>

    <section className={styles.layout}>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>TOP 30</span><h2>분석 대기열</h2></div><small>{jobs.length}개</small></div>
        <div className={styles.jobs}>{jobs.map((job) => <button key={job.id} className={selected?.id === job.id ? styles.activeJob : ""} onClick={() => setSelectedId(job.candidate_id)}>
          <b>#{job.rank || "-"} {job.china_video_candidates?.title || "제목 없음"}</b><span>{job.china_video_candidates?.platform} · V3 {job.china_video_candidates?.total_intelligence_score || 0}점</span><i>{job.status}</i>
        </button>)}{!jobs.length && <p>상위 30개 선별을 먼저 실행해주세요.</p>}</div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>RIGHTS & SOURCE</span><h2>권리 확인 원본 준비</h2></div><small>미확인 원본 자동 다운로드 금지</small></div>
        {selected ? <>
          <p className={styles.selectedTitle}>#{selected.rank} {selected.china_video_candidates?.title}</p>
          <div className={styles.formGrid}>
            <select value={rightsStatus} onChange={(e) => setRightsStatus(e.target.value)}>{rightsOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
            <input value={rightsEvidence} onChange={(e) => setRightsEvidence(e.target.value)} placeholder="권리 근거: 직접 촬영, 판매자 제공 메일, 제휴센터 소재 등" />
            <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="권리 확인된 직접 영상 HTTPS 주소" />
            <button onClick={() => void requestFrames()} disabled={busy || !sourceUrl || rightsEvidence.length < 3}>자동 저장 + 프레임 12장</button>
          </div>
          <div className={styles.upload}><input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(e) => setFile(e.target.files?.[0] || null)} /><button onClick={() => void uploadVideo()} disabled={busy || !file || rightsEvidence.length < 3}>45MB 이하 직접 업로드</button></div>
          <div className={styles.frames}>{(selected.frame_urls || []).map((url: string, index: number) => <figure key={url}><img src={url} alt="" /><figcaption>{Number((selected.frame_timestamps || [])[index] || 0).toFixed(1)}초</figcaption></figure>)}</div>
        </> : <p>왼쪽에서 후보를 선택해주세요.</p>}
      </div>
    </section>

    {selected && <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>STEP 3</span><h2>Gemini 정밀 장면 분석</h2></div><small>영상 60MB 이하 직접 분석 · 초과 시 대표 프레임 분석</small></div>
      <div className={styles.actions}><button onClick={() => void analyze("auto")} disabled={busy || !selected.source_video_url}>Gemini API 정밀분석</button><button onClick={() => void analyze("manual-export")} disabled={busy}>Gemini Pro 분석자료</button></div>
      {manualPrompt && <div className={styles.manual}><textarea readOnly value={manualPrompt} /><button onClick={() => void copy(manualPrompt)}>프롬프트 복사</button><textarea value={manualJson} onChange={(e) => setManualJson(e.target.value)} placeholder="Gemini Pro JSON 결과 붙여넣기" /><button onClick={() => void importManual()} disabled={busy || !manualJson.trim()}>JSON 분석 저장</button></div>}
    </section>}

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span>TIMELINE</span><h2>프레임·타임스탬프 장면 구조</h2></div><small>{selectedSegments.length}개 장면</small></div>
      <div className={styles.timeline}>{selectedSegments.map((scene) => <article key={scene.id}>{scene.representative_frame_url && <img src={scene.representative_frame_url} alt="" />}<div><b>{Number(scene.start_second).toFixed(1)}~{Number(scene.end_second).toFixed(1)}초 · {scene.role}</b><p>{scene.visual_description}</p><p><strong>재창작:</strong> {scene.recreate_direction}</p><small>훅 {scene.hook_score} · 증명 {scene.proof_score} · 상품노출 {scene.product_visibility_score} · 저작권위험 {scene.copyright_risk_score}</small></div></article>)}{!selectedSegments.length && <p>Gemini 정밀분석을 완료하면 타임라인이 표시됩니다.</p>}</div>
    </section>

    <section className={styles.panel}><div className={styles.safety}>도우인·샤오홍슈 권리 미확인 영상은 원본 저장·최종 사용을 차단합니다. 분석 결과는 고유 표현을 복제하지 않고 신규 한국형 촬영·AI 장면의 구조 참고로만 사용합니다.</div></section>
  </main>;
}
