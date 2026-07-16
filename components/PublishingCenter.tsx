"use client";

import { useMemo, useState } from "react";

type ContentItem = {
  id: string;
  product_title: string;
  title: string;
  content: string;
  content_type: string;
  created_at: string;
};

type PublishingJob = {
  id: string;
  channel: string;
  title: string;
  content: string;
  status: string;
  scheduled_at: string;
  published_at?: string | null;
  last_error?: string | null;
  attempts?: number;
  payload?: { resultUrl?: string | null; isDraft?: boolean } | null;
};

const channelLabel: Record<string, string> = {
  blogger: "Blogger",
  wordpress: "WordPress",
  webhook: "자동화 웹훅",
};

const statusLabel: Record<string, string> = {
  queued: "대기",
  processing: "처리 중",
  published: "게시 완료",
  retry: "재시도 대기",
  cancelled: "취소",
};

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export default function PublishingCenter({ initialJobs, contents, databaseReady = true }: { initialJobs: PublishingJob[]; contents: ContentItem[]; databaseReady?: boolean }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [channel, setChannel] = useState("blogger");
  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState(localDateTimeValue());
  const [isDraft, setIsDraft] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [strategy, setStrategy] = useState("approval");

  const selectedSource = useMemo(() => contents.find((item) => item.id === sourceId), [contents, sourceId]);

  function chooseSource(id: string) {
    setSourceId(id);
    const item = contents.find((row) => row.id === id);
    if (item) {
      setTitle(item.title || item.product_title);
      setContent(item.content || "");
    }
  }

  async function refreshJobs() {
    const response = await fetch("/api/publishing/jobs", { cache: "no-store" });
    const data = await response.json();
    if (data.success) setJobs(data.jobs || []);
  }

  async function createJob() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/publishing/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          title,
          content,
          scheduledAt: new Date(scheduledAt).toISOString(),
          payload: { isDraft: channel === "blogger" ? isDraft : false, sourceContentId: selectedSource?.id || null },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "게시 작업 등록 실패");
      setMessage("게시 대기함에 등록했습니다.");
      await refreshJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시 작업 등록 실패");
    } finally {
      setLoading(false);
    }
  }

  async function runQueue() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/publish/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "게시 실행 실패");
      setMessage(`${data.processed}개 작업을 처리했습니다.`);
      await refreshJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시 실행 실패");
    } finally {
      setLoading(false);
    }
  }

  async function changeJob(id: string, action: "retry" | "cancel") {
    await fetch("/api/publishing/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    await refreshJobs();
  }

  async function deleteJob(id: string) {
    if (!window.confirm("이 게시 작업을 삭제할까요?")) return;
    await fetch(`/api/publishing/jobs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await refreshJobs();
  }

  const queuedCount = jobs.filter((job) => ["queued", "retry"].includes(job.status)).length;
  const publishedCount = jobs.filter((job) => job.status === "published").length;
  const failedCount = jobs.filter((job) => ["retry", "cancelled"].includes(job.status)).length;

  return (
    <div className="admin-page publishing-command-center">
      <section className="publishing-hero">
        <div>
          <span className="dashboard-kicker">GY BUILD 05 · PUBLISHING CENTER</span>
          <h1>콘텐츠를 결과로 연결하는<br />GY Publishing.</h1>
          <p>승인용 글과 성장형 SEO 콘텐츠를 분리하고, 검수된 결과물만 채널별 초안·예약·게시 흐름으로 보냅니다.</p>
          <div className="publishing-hero-actions">
            <button className="button button-primary" disabled={loading || !databaseReady} onClick={runQueue}>대기 작업 지금 실행</button>
            <a className="button button-light" href="/admin/connections">채널 연결 확인</a>
          </div>
        </div>
        <div className="publishing-live-card">
          <div className="publishing-live-head"><span>GY PUBLISHING LIVE</span><b><i /> READY</b></div>
          <div className="publishing-live-metrics">
            <div><small>Queue</small><strong>{queuedCount}</strong></div>
            <div><small>Published</small><strong>{publishedCount}</strong></div>
            <div><small>Attention</small><strong>{failedCount}</strong></div>
          </div>
          <p>{databaseReady ? "Supabase 게시 대기함이 연결되어 있습니다." : "Supabase 연결 후 실제 예약·게시 작업을 사용할 수 있습니다."}</p>
        </div>
      </section>

      <section className="publishing-strategy-row" aria-label="게시 전략 선택">
        {[
          ["approval", "승인 중심", "AdSense·AdPost 심사에 맞춘 정보성, 독창성, 신뢰성 중심"],
          ["seo", "SEO 성장", "검색 의도, 제목 CTR, 내부 구조와 장기 유입 중심"],
          ["commerce", "쇼핑 전환", "상품 가치와 사용 장면을 살리되 과장 없이 전환 중심"],
          ["dual", "동시 생성", "같은 주제를 플랫폼별로 다르게 작성해 중복 위험 최소화"],
        ].map(([id, title, text]) => (
          <button type="button" key={id} onClick={() => setStrategy(id)} className={`publishing-strategy-chip ${strategy === id ? "active" : ""}`}>
            <span>{strategy === id ? "✓" : "+"}</span><strong>{title}</strong><small>{text}</small>
          </button>
        ))}
      </section>

      {!databaseReady && (
        <div className="alert alert-warning publishing-alert">게시센터 화면은 정상입니다. 실제 대기함·예약·게시 기능은 Supabase 연결 및 마이그레이션 후 활성화됩니다.</div>
      )}
      {message && <div className="alert alert-warning publishing-alert">{message}</div>}

      <section className="publishing-channel-grid">
        <article><span className="channel-status connected" /><div><strong>Blogger</strong><small>공식 OAuth · 초안 및 게시</small></div><a href="/admin/connections">설정</a></article>
        <article><span className="channel-status" /><div><strong>Naver</strong><small>승인·SEO 원고 복사 발행</small></div><a href="/admin/publishing-strategy">전략</a></article>
        <article><span className="channel-status" /><div><strong>YouTube</strong><small>완성 MP4 공식 업로드</small></div><a href="/admin/youtube">열기</a></article>
        <article><span className="channel-status" /><div><strong>Automation</strong><small>Make · Zapier · n8n 웹훅</small></div><a href="/admin/automation">열기</a></article>
      </section>

      <div className="publishing-workspace">
        <section className="panel publishing-composer">
          <div className="publishing-panel-title"><div><span className="panel-kicker">COMPOSE & SCHEDULE</span><h2>새 게시 작업</h2></div><span className="publishing-mode-badge">{strategy.toUpperCase()}</span></div>
          <div className="form-grid" style={{ marginTop: 18 }}>
            <label className="field">
              <span>게시 채널</span>
              <select value={channel} onChange={(event) => setChannel(event.target.value)}>
                <option value="blogger">Blogger 공식 API</option>
                <option value="wordpress">WordPress REST API</option>
                <option value="webhook">Make·Zapier·n8n 웹훅</option>
              </select>
            </label>
            <label className="field">
              <span>저장 콘텐츠 불러오기</span>
              <select value={sourceId} onChange={(event) => chooseSource(event.target.value)}>
                <option value="">직접 입력</option>
                {contents.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.product_title}</option>)}
              </select>
            </label>
            <label className="field field-full"><span>게시 제목</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="게시 제목" /></label>
            <label className="field field-full"><span>게시 본문</span><textarea rows={14} value={content} onChange={(event) => setContent(event.target.value)} placeholder="검수된 콘텐츠를 입력하거나 불러오세요." /></label>
            <label className="field"><span>게시 예약 시간</span><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
            {channel === "blogger" && <label className="field"><span>Blogger 방식</span><span className="publishing-check"><input type="checkbox" checked={isDraft} onChange={(event) => setIsDraft(event.target.checked)} /> 초안으로 저장</span></label>}
          </div>
          <button className="button button-primary" disabled={loading || !databaseReady || !title.trim() || !content.trim()} onClick={createJob}>게시 대기함에 추가</button>
        </section>

        <aside className="panel publishing-quality-gate">
          <span className="panel-kicker">QUALITY GATE</span><h2>게시 전 최종 확인</h2>
          <div className="quality-check-list">
            <div><i className={title.trim() ? "done" : ""} />제목과 검색 의도</div>
            <div><i className={content.length > 300 ? "done" : ""} />본문 충분성</div>
            <div><i className={strategy ? "done" : ""} />게시 목적 분리</div>
            <div><i className={channel ? "done" : ""} />채널 선택</div>
          </div>
          <p>GY Quality Center에서 사실성·SEO·브랜드 검사를 완료한 콘텐츠만 게시 대기함에 넣는 것을 권장합니다.</p>
          <a className="gy-text-link" href="/admin/quality-center">GY Quality 열기 ↗</a>
        </aside>
      </div>

      <section className="panel publishing-queue-panel">
        <div className="publishing-panel-title"><div><span className="panel-kicker">PUBLISHING QUEUE</span><h2>게시 대기함</h2><p>예약 시간이 지난 작업만 실행됩니다.</p></div><button className="button button-light" onClick={refreshJobs} disabled={!databaseReady}>새로고침</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>채널</th><th>제목</th><th>상태</th><th>예약</th><th>시도</th><th>결과</th><th>관리</th></tr></thead>
            <tbody>
              {jobs.length ? jobs.map((job) => (
                <tr key={job.id}>
                  <td><span className="channel-pill">{channelLabel[job.channel] || job.channel}</span></td><td><b>{job.title}</b></td><td>{statusLabel[job.status] || job.status}</td><td>{new Date(job.scheduled_at).toLocaleString("ko-KR")}</td><td>{job.attempts || 0}</td>
                  <td>{job.payload?.resultUrl ? <a href={job.payload.resultUrl} target="_blank" rel="noreferrer">열기</a> : job.last_error || "-"}</td>
                  <td className="publishing-row-actions">{(job.status === "retry" || job.status === "cancelled") && <button className="button button-light" onClick={() => changeJob(job.id, "retry")}>재시도</button>}{!["published", "cancelled"].includes(job.status) && <button className="button button-light" onClick={() => changeJob(job.id, "cancel")}>취소</button>}<button className="button button-light" onClick={() => deleteJob(job.id)}>삭제</button></td>
                </tr>
              )) : <tr><td colSpan={7}><div className="empty">아직 등록된 게시 작업이 없습니다.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

}