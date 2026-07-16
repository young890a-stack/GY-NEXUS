"use client";

import { useState } from "react";

type Check = { ok: boolean; message: string };
type Result = { ok: boolean; checkedAt: string; checks: Record<string, Check> };

export default function SystemDiagnostics() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system/health", { cache: "no-store" });
      const data = (await response.json()) as Result;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "진단을 실행하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 20 }} suppressHydrationWarning>
      <h2>원클릭 연결 진단</h2>
      <p className="help">키를 입력한 뒤 이 버튼으로 서버·Supabase·DB·OpenAI 연결을 한 번에 검사합니다.</p>
      <button className="button button-primary" type="button" onClick={run} disabled={loading}>
        {loading ? "진단 중..." : "전체 연결 진단 실행"}
      </button>
      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
      {result && (
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          {Object.entries(result.checks).map(([name, check]) => (
            <div className="mini-stat" key={name}>
              <b>{check.ok ? "✅" : "❌"} {name.toUpperCase()}</b>
              <p>{check.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
