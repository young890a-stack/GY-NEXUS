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

export default function PublishingCenter({ initialJobs, contents }: { initialJobs: PublishingJob[]; contents: ContentItem[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [channel, setChannel] = useState("blogger");
  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState(localDateTimeValue());
  const [isDraft, setIsDraft] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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

  return (
    <div className="admin-page">
      <div className="admin-top">
        <div>
          <span className="eyebrow">SPRINT 5 · ONE-CLICK PUBLISHER</span>
          <h1>원클릭 게시센터</h1>
          <p>저장된 AI 콘텐츠를 Blogger·WordPress·자동화 웹훅으로 예약하고 게시합니다.</p>
        </div>
        <button className="button button-primary" disabled={loading} onClick={runQueue}>지금 게시 실행</button>
      </div>

      {message && <div className="alert alert-warning" style={{ marginBottom: 18 }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, .7fr)", gap: 20, alignItems: "start" }}>
        <section className="panel">
          <h2>새 게시 작업</h2>
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
            <label className="field field-full">
              <span>게시 제목</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="게시 제목" />
            </label>
            <label className="field field-full">
              <span>게시 본문</span>
              <textarea rows={14} value={content} onChange={(event) => setContent(event.target.value)} placeholder="게시할 본문을 입력하세요." />
            </label>
            <label className="field">
              <span>게시 예약 시간</span>
              <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </label>
            {channel === "blogger" && (
              <label className="field" style={{ justifyContent: "end" }}>
                <span>Blogger 게시 방식</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
                  <input type="checkbox" checked={isDraft} onChange={(event) => setIsDraft(event.target.checked)} /> 초안으로 저장
                </span>
              </label>
            )}
          </div>
          <button className="button button-primary" disabled={loading || !title.trim() || !content.trim()} onClick={createJob}>게시 대기함에 추가</button>
        </section>

        <section className="panel">
          <h2>연결 안내</h2>
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <div className="alert alert-info"><b>Blogger</b><br />외부 채널 연결센터에서 Blogger OAuth를 연결하면 공식 API로 게시합니다.</div>
            <div className="alert alert-info"><b>WordPress</b><br />.env.local에 WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD를 입력합니다.</div>
            <div className="alert alert-info"><b>네이버 블로그</b><br />공식 글쓰기 API가 제공되지 않아 자동 게시 대신 콘텐츠 복사·수동 발행 흐름을 유지합니다.</div>
            <div className="alert alert-info"><b>YouTube Shorts</b><br />왼쪽 YouTube 메뉴의 공식 업로더에서 완성 MP4를 올릴 수 있습니다.</div>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="admin-top" style={{ marginBottom: 12 }}>
          <div><h2>게시 대기함</h2><p>예약 시간이 지난 작업만 ‘지금 게시 실행’에서 처리됩니다.</p></div>
          <button className="button button-light" onClick={refreshJobs}>새로고침</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>채널</th><th>제목</th><th>상태</th><th>예약</th><th>시도</th><th>결과</th><th>관리</th></tr></thead>
            <tbody>
              {jobs.length ? jobs.map((job) => (
                <tr key={job.id}>
                  <td>{channelLabel[job.channel] || job.channel}</td>
                  <td><b>{job.title}</b></td>
                  <td>{statusLabel[job.status] || job.status}</td>
                  <td>{new Date(job.scheduled_at).toLocaleString("ko-KR")}</td>
                  <td>{job.attempts || 0}</td>
                  <td>{job.payload?.resultUrl ? <a href={job.payload.resultUrl} target="_blank" rel="noreferrer">열기</a> : job.last_error || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {(job.status === "retry" || job.status === "cancelled") && <button className="button button-light" onClick={() => changeJob(job.id, "retry")}>재시도</button>}
                    {!["published", "cancelled"].includes(job.status) && <button className="button button-light" onClick={() => changeJob(job.id, "cancel")}>취소</button>}
                    <button className="button button-light" onClick={() => deleteJob(job.id)}>삭제</button>
                  </td>
                </tr>
              )) : <tr><td colSpan={7}>등록된 게시 작업이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
