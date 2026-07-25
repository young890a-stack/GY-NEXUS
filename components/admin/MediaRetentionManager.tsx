"use client";

import { useState } from "react";

type Asset = { path: string; size: number; createdAt: string | null };
type Result = {
  mode: "preview" | "delete";
  retentionDays: number;
  count: number;
  totalBytes: number;
  truncated: boolean;
  assets: Asset[];
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function MediaRetentionManager() {
  const [retentionDays, setRetentionDays] = useState(90);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function run(mode: "preview" | "delete") {
    if (mode === "delete" && !window.confirm(
      `미리보기에서 확인한 ${result?.count ?? 0}개 파일을 영구 삭제할까요?`,
    )) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/media-retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, retentionDays }),
      });
      const data = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(data.error || "작업을 완료하지 못했습니다.");
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "작업을 완료하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="section-head">
        <div><h2>자동 보관 기준</h2><p>날짜별 제작 폴더만 검사하며, 확인되지 않은 경로는 건드리지 않습니다.</p></div>
      </div>
      <label className="field">
        <span>보관 기간</span>
        <select value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))}>
          <option value={30}>30일</option><option value={90}>90일</option>
          <option value={180}>180일</option><option value={365}>1년</option><option value={730}>2년</option>
        </select>
      </label>
      <div className="actions" style={{ marginTop: 16 }}>
        <button className="button button-primary" type="button" disabled={loading} onClick={() => run("preview")}>
          {loading ? "확인 중..." : "삭제 대상 미리보기"}
        </button>
        <button className="button button-light" type="button" disabled={loading || !result || result.count === 0 || result.mode === "delete"} onClick={() => run("delete")}>
          확인한 파일 삭제
        </button>
      </div>
      {error && <div className="alert alert-warning" style={{ marginTop: 16 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 20 }}>
          <div className={`alert ${result.mode === "delete" ? "alert-success" : "alert-warning"}`}>
            {result.mode === "delete" ? "정리 완료" : "미리보기"} · {result.count}개 · {formatBytes(result.totalBytes)}
            {result.truncated ? " · 한 번에 최대 500개씩 처리합니다." : ""}
          </div>
          {result.assets.length > 0 && (
            <div className="status-list" style={{ marginTop: 12 }}>
              {result.assets.slice(0, 20).map((asset) => (
                <div className="status-row" key={asset.path}>
                  <div><strong>{asset.path}</strong><small>{asset.createdAt || "생성일 정보 없음"}</small></div>
                  <b>{formatBytes(asset.size)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

