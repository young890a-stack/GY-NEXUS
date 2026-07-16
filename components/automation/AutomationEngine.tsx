"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Product = { id: string; title: string };
type Job = {
  id: string;
  status: string;
  current_step?: string | null;
  attempts?: number | null;
  max_attempts?: number | null;
  last_error?: string | null;
  created_at: string;
  scheduled_at: string;
  config?: Record<string, unknown> | null;
  result_data?: Record<string, unknown> | null;
  products?: { title?: string } | null;
};
type Log = {
  id: string;
  job_id: string;
  step: string;
  status: string;
  message: string;
  created_at: string;
};

type Props = { products: Product[]; jobs: Job[]; logs: Log[] };

const stepLabels: Record<string, string> = {
  queued: "대기",
  product: "상품 선택",
  content: "AI 콘텐츠",
  image: "이미지",
  video: "영상",
  blogger: "Blogger",
  wordpress: "WordPress",
  webhook: "웹훅",
  youtube: "YouTube",
  completed: "완료",
  retry: "재시도 대기",
  cancelled: "취소",
};

function statusLabel(status: string) {
  return ({ queued: "대기", processing: "실행 중", retry: "재시도", completed: "완료", failed: "실패", cancelled: "취소" } as Record<string, string>)[status] || status;
}

export default function AutomationEngine({ products, jobs, logs }: Props) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [generateImage, setGenerateImage] = useState(true);
  const [generateVideo, setGenerateVideo] = useState(false);
  const [publishBlogger, setPublishBlogger] = useState(false);
  const [publishYouTube, setPublishYouTube] = useState(false);
  const [publishWordPress, setPublishWordPress] = useState(false);
  const [publishWebhook, setPublishWebhook] = useState(false);
  const [bloggerDraft, setBloggerDraft] = useState(true);
  const [youtubePrivacy, setYoutubePrivacy] = useState<"private" | "unlisted" | "public">("private");
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");

  const counts = useMemo(() => ({
    queued: jobs.filter((j) => ["queued", "retry"].includes(j.status)).length,
    processing: jobs.filter((j) => j.status === "processing").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  }), [jobs]);

  async function createJob(runNow: boolean) {
    if (!productId && products.length) return;
    if (publishYouTube && !generateVideo) {
      setMessage("YouTube 업로드를 사용하려면 영상 생성을 켜주세요.");
      return;
    }
    setLoading(runNow ? "run" : "queue");
    setMessage("");
    try {
      const response = await fetch("/api/automation/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: productId || undefined,
          runNow,
          config: { generateImage, generateVideo, publishBlogger, publishYouTube, publishWordPress, publishWebhook, bloggerDraft, youtubePrivacy },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "작업 등록 실패");
      if (runNow) {
        setMessage("작업을 등록했습니다. AI 회사 엔진이 순서대로 실행합니다.");
        const runResponse = await fetch("/api/automation/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: data.job.id }),
        });
        const runData = await runResponse.json();
        const first = runData.results?.[0];
        setMessage(first?.success ? "✅ 전체 워크플로우가 완료됐습니다." : `⚠️ ${first?.message || runData.message || "실행 결과를 확인해주세요."}`);
      } else {
        setMessage("✅ 작업 큐에 등록했습니다.");
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "자동화 작업을 처리하지 못했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function processQueue() {
    setLoading("process"); setMessage("");
    try {
      const response = await fetch("/api/automation/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 3 }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "대기열 실행 실패");
      const successCount = (data.results || []).filter((x: { success: boolean }) => x.success).length;
      setMessage(data.processed ? `대기 작업 ${data.processed}건 처리 · 성공 ${successCount}건` : data.message);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "대기열 실행 실패"); }
    finally { setLoading(""); }
  }

  async function changeJob(id: string, action: "retry" | "cancel") {
    setLoading(id); setMessage("");
    try {
      const response = await fetch("/api/automation/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "작업 변경 실패");
      setMessage(action === "retry" ? "재시도 대기열에 등록했습니다." : "작업을 취소했습니다.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "작업 변경 실패"); }
    finally { setLoading(""); }
  }

  return <>
    <section className="panel" style={{ marginBottom: 22 }}>
      <div className="section-head"><div><span className="eyebrow">SPRINT 6 · AI COMPANY ENGINE</span><h2>Automation Engine</h2><p>상품 하나를 선택하면 콘텐츠 → 이미지 → 영상 → 게시를 단계별로 실행하고 모든 결과를 기록합니다.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(260px,.8fr) minmax(0,1.2fr)", gap: 20 }}>
        <div className="form-grid">
          <div className="form-group"><label>실행할 상품</label><select className="select" value={productId} onChange={(e)=>setProductId(e.target.value)}><option value="">AI가 최적 상품 자동 선택</option>{products.map((p)=><option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          <div className="notice"><b>안전 기본값</b><br/>Blogger는 초안, YouTube는 비공개로 시작합니다. 실제 공개 전 대표 검토를 유지합니다.</div>
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <label className="mini-stat"><input type="checkbox" checked={generateImage} onChange={(e)=>setGenerateImage(e.target.checked)}/> <b>🎨 이미지 자동 생성</b><p>OpenAI → Supabase Storage</p></label>
          <label className="mini-stat"><input type="checkbox" checked={generateVideo} onChange={(e)=>setGenerateVideo(e.target.checked)}/> <b>🎬 5초 영상 자동 생성</b><p>Runway API 크레딧 필요</p></label>
          <label className="mini-stat"><input type="checkbox" checked={publishBlogger} onChange={(e)=>setPublishBlogger(e.target.checked)}/> <b>📝 Blogger 게시</b><p><input type="checkbox" checked={bloggerDraft} onChange={(e)=>setBloggerDraft(e.target.checked)}/> 초안으로 저장</p></label>
          <label className="mini-stat"><input type="checkbox" checked={publishYouTube} onChange={(e)=>setPublishYouTube(e.target.checked)}/> <b>▶ YouTube Shorts</b><p><select value={youtubePrivacy} onChange={(e)=>setYoutubePrivacy(e.target.value as typeof youtubePrivacy)}><option value="private">비공개</option><option value="unlisted">일부 공개</option><option value="public">공개</option></select></p></label>
          <label className="mini-stat"><input type="checkbox" checked={publishWordPress} onChange={(e)=>setPublishWordPress(e.target.checked)}/> <b>🌐 WordPress 게시</b><p>.env 연결 정보 사용</p></label>
          <label className="mini-stat"><input type="checkbox" checked={publishWebhook} onChange={(e)=>setPublishWebhook(e.target.checked)}/> <b>🔗 자동화 웹훅</b><p>Make·Zapier·n8n</p></label>
        </div>
      </div>
      <div className="actions" style={{ marginTop: 20 }}>
        <button className="button button-primary" disabled={Boolean(loading)} onClick={()=>createJob(true)}>{loading === "run" ? "AI 회사 실행 중..." : "⚡ 지금 전체 실행"}</button>
        <button className="button button-light" disabled={Boolean(loading)} onClick={()=>createJob(false)}>{loading === "queue" ? "등록 중..." : "📥 작업 큐에 등록"}</button>
        <button className="button button-dark" disabled={Boolean(loading)} onClick={processQueue}>{loading === "process" ? "대기열 처리 중..." : "▶ 대기 작업 3건 실행"}</button>
      </div>
      {message && <div className={message.includes("실패") || message.includes("⚠️") ? "alert alert-error" : "alert alert-success"} style={{ marginTop: 16 }}>{message}</div>}
    </section>

    <div className="grid grid-4" style={{ marginBottom: 22 }}>
      <div className="stat-card"><span>대기·재시도</span><strong>{counts.queued}</strong><small>실행 준비 작업</small></div>
      <div className="stat-card"><span>실행 중</span><strong>{counts.processing}</strong><small>현재 처리 중</small></div>
      <div className="stat-card"><span>완료</span><strong>{counts.completed}</strong><small>전체 성공</small></div>
      <div className="stat-card"><span>실패</span><strong>{counts.failed}</strong><small>대표 확인 필요</small></div>
    </div>

    <section className="panel" style={{ marginBottom: 22 }}>
      <div className="section-head"><h2>작업 큐</h2></div>
      <div className="table-wrap"><table><thead><tr><th>상품</th><th>상태</th><th>현재 단계</th><th>시도</th><th>결과</th><th>관리</th></tr></thead><tbody>
        {jobs.length ? jobs.map((job)=><tr key={job.id}>
          <td>{job.products?.title || String(job.result_data?.productTitle || "자동 선택")}</td>
          <td><span className="badge">{statusLabel(job.status)}</span></td>
          <td>{stepLabels[job.current_step || "queued"] || job.current_step || "-"}</td>
          <td>{job.attempts || 0}/{job.max_attempts || 3}</td>
          <td>{job.status === "completed" ? <>{job.result_data?.bloggerUrl && <a href={String(job.result_data.bloggerUrl)} target="_blank">Blogger </a>}{job.result_data?.youtubeUrl && <a href={String(job.result_data.youtubeUrl)} target="_blank">YouTube</a>}</> : <span style={{ color: "var(--muted)" }}>{job.last_error || "-"}</span>}</td>
          <td><div className="actions" style={{ margin: 0 }}>{["failed","retry"].includes(job.status) && <button className="button button-light" disabled={loading===job.id} onClick={()=>changeJob(job.id,"retry")}>재시도</button>}{!["completed","cancelled"].includes(job.status) && <button className="button button-light" disabled={loading===job.id} onClick={()=>changeJob(job.id,"cancel")}>취소</button>}</div></td>
        </tr>) : <tr><td colSpan={6}>아직 자동화 작업이 없습니다.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="panel">
      <div className="section-head"><h2>자동 실행 로그</h2><p>어느 단계에서 성공·실패했는지 시간순으로 확인합니다.</p></div>
      <div className="table-wrap"><table><thead><tr><th>시간</th><th>단계</th><th>상태</th><th>메시지</th></tr></thead><tbody>
        {logs.length ? logs.slice(0,50).map((log)=><tr key={log.id}><td>{new Date(log.created_at).toLocaleString("ko-KR")}</td><td>{stepLabels[log.step] || log.step}</td><td>{log.status}</td><td>{log.message}</td></tr>) : <tr><td colSpan={4}>로그가 없습니다.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
