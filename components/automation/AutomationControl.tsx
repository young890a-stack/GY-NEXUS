"use client";
import { useState } from "react";

export default function AutomationControl() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("manual");
  const [autoPublish, setAutoPublish] = useState(false);
  async function run() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/automation/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, autoPublish }) });
      const data = await response.json();
      setMessage(data.success ? `완료: ${data.product}` : data.message || "실패");
    } catch { setMessage("자동화 실행 중 오류가 발생했습니다."); }
    finally { setLoading(false); }
  }
  return <div className="panel form-grid">
    <div className="form-group"><label>게시 방식</label><select className="select" value={channel} onChange={(e)=>setChannel(e.target.value)}><option value="manual">검토 대기함</option><option value="wordpress">WordPress 자동 게시</option><option value="webhook">Make·Zapier·n8n 웹훅</option></select></div>
    <label style={{display:"flex",gap:10,alignItems:"center"}}><input type="checkbox" checked={autoPublish} onChange={(e)=>setAutoPublish(e.target.checked)} /> 생성 후 게시 대기열에 자동 등록</label>
    <button className="button button-primary" onClick={run} disabled={loading}>{loading ? "AI 직원 실행 중..." : "⚡ 원터치 자동 운영 실행"}</button>
    {message && <div className="notice notice-success">{message}</div>}
  </div>;
}
