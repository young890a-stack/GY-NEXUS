"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";

type Action = { id: string; label: string; description: string; href: string; risk: "safe" | "approval" };

export default function AiOperationsAssistant() {
  const [command, setCommand] = useState("Temu 상품 링크를 분석하고 Blogger 글과 20초 쇼츠 제작 계획을 만들어줘.");
  const [summary, setSummary] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setSummary(""); setActions([]);
    try {
      const response = await fetch("/api/assistant/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "실행 계획 생성 실패");
      setSummary(data.summary); setActions(data.actions || []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "오류가 발생했습니다."); }
    finally { setLoading(false); }
  }

  return <div className="assistant-shell">
    <form className="assistant-command" onSubmit={submit}>
      <label htmlFor="assistant-command">대표 명령</label>
      <textarea id="assistant-command" value={command} onChange={(e) => setCommand(e.target.value)} rows={5} />
      <button disabled={loading}>{loading ? "계획 수립 중..." : "AI 비서에게 실행 계획 맡기기"}</button>
    </form>
    {error && <div className="connection-alert error">{error}</div>}
    {summary && <section className="assistant-result"><span className="eyebrow">AI OPERATIONS PLAN</span><h2>실행 계획</h2><p>{summary}</p>
      <div className="assistant-actions">{actions.map((action, index) => <article key={action.id}><span>{index + 1}</span><div><h3>{action.label}</h3><p>{action.description}</p>{action.risk === "approval" && <small>대표 승인 필요</small>}</div><Link href={action.href}>작업 화면 열기</Link></article>)}</div>
    </section>}
  </div>;
}
