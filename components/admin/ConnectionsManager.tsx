"use client";
import { useEffect, useMemo, useState } from "react";

type Id = "youtube" | "blogger" | "naver" | "temu";
type Connection = { id: Id; name: string; connected: boolean; configured: boolean; detail: string; account?: string; limitation?: string };
type StatusResponse = { success: boolean; connections: Connection[]; core?: { openai: boolean; supabase: boolean } };
const metadata: Record<Id, { icon: string; purpose: string; env: string[] }> = {
  youtube: { icon: "▶️", purpose: "채널 조회 · 영상 업로드", env: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"] },
  blogger: { icon: "📝", purpose: "블로그 조회 · 글 게시", env: ["BLOGGER_CLIENT_ID", "BLOGGER_CLIENT_SECRET", "BLOGGER_BLOG_ID(선택)"] },
  naver: { icon: "🟢", purpose: "계정 연결 · 콘텐츠 전송 준비", env: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"] },
  temu: { icon: "🟠", purpose: "상품별 제휴 링크 운영", env: ["TEMU_AFFILIATE_ID(선택)", "상품별 affiliate_url"] },
};
export default function ConnectionsManager() {
  const [connections, setConnections] = useState<Connection[]>([]); const [core, setCore] = useState({ openai: false, supabase: false }); const [loading, setLoading] = useState(true); const [actionId, setActionId] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const connectedCount = useMemo(() => connections.filter((i) => i.connected).length + Number(core.openai) + Number(core.supabase), [connections, core]);
  async function loadStatus() { setLoading(true); try { const r = await fetch("/api/connections/status", { cache: "no-store" }); const d = await r.json() as StatusResponse; if (!r.ok || !d.success) throw new Error(); setConnections(d.connections); setCore(d.core || core); } catch { setError("연결 상태를 불러오지 못했습니다."); } finally { setLoading(false); } }
  useEffect(() => { void loadStatus(); }, []);
  async function disconnect(id: "youtube" | "blogger" | "naver") { setActionId(id); setMessage(""); setError(""); try { const r = await fetch(`/api/connections/${id}/disconnect`, { method: "POST" }); if (!r.ok) throw new Error(); setMessage(`${metadata[id].purpose} 연결을 해제했습니다.`); await loadStatus(); } catch { setError("연결 해제에 실패했습니다."); } finally { setActionId(""); } }
  return <div className="connections-manager">
    <section className="connections-summary"><div className="metric-card"><span>핵심·채널 연결</span><strong>6</strong></div><div className="metric-card"><span>준비 완료</span><strong>{connectedCount}</strong></div><div className="metric-card"><span>남은 연결</span><strong>{6-connectedCount}</strong></div></section>
    <section className="core-connections"><article><span>🧠</span><div><h2>OpenAI</h2><p>AI 비서·상품 분석·콘텐츠 생성</p></div><strong className={core.openai ? "done" : "missing"}>{core.openai ? "준비 완료" : "키 필요"}</strong></article><article><span>🗄️</span><div><h2>Supabase</h2><p>상품·콘텐츠·작업·통계 저장</p></div><strong className={core.supabase ? "done" : "missing"}>{core.supabase ? "준비 완료" : "키 필요"}</strong></article></section>
    {message && <div className="connection-alert success">{message}</div>}{error && <div className="connection-alert error">{error}</div>}
    <section className="connections-grid">{loading ? <article className="connection-card loading">상태를 확인하고 있습니다...</article> : connections.map((c) => { const m=metadata[c.id]; const oauth=c.id!=="temu"; return <article className="connection-card" key={c.id}><div className="connection-card-top"><div className="connection-title-wrap"><span className="connection-icon">{m.icon}</span><div><p>{m.purpose}</p><h2>{c.name}</h2></div></div><span className={`connection-badge ${c.connected?"connected":c.configured?"ready":"missing"}`}>{c.connected?"연결 완료":c.configured?"승인 필요":"설정 필요"}</span></div>{c.account&&<div className="connection-account">연결 대상: <strong>{c.account}</strong></div>}<p className="connection-detail">{c.detail}</p><div className="connection-env-box"><strong>연결 항목</strong>{m.env.map((e)=><code key={e}>{e}</code>)}</div>{c.limitation&&<p className="connection-limitation">{c.limitation}</p>}<div className="connection-actions">{oauth ? c.connected ? <button disabled={actionId===c.id} onClick={()=>void disconnect(c.id as "youtube"|"blogger"|"naver")}>연결 해제</button> : <a className={!c.configured?"disabled":""} href={c.configured?`/api/connections/${c.id}/start`:undefined}>계정 연결</a> : <a href="/admin/products/new">Temu 상품 등록</a>}</div></article>})}</section>
  </div>;
}
