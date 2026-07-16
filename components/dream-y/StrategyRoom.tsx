"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { DREAM_AGENTS } from "@/lib/dream-y/agents";
import type { StrategyResult } from "@/lib/dream-y/company-brain";

export default function StrategyRoom() {
  const [command,setCommand]=useState("이번 주 제휴 수익을 높이기 위한 상품과 콘텐츠 전략을 회의해줘.");
  const [result,setResult]=useState<StrategyResult|null>(null);
  const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError("");
    try{const r=await fetch("/api/company/strategy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({command})}); const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.message||"회의 실패"); setResult(d.result);}catch(x){setError(x instanceof Error?x.message:"회의 실패");}finally{setLoading(false)}}
  return <div className="dy-strategy-layout">
    <form className="dy-command-card" onSubmit={submit}><span className="eyebrow">DREAM Y COMMAND</span><h2>대표 명령</h2><textarea rows={6} value={command} onChange={e=>setCommand(e.target.value)}/><button disabled={loading}>{loading?"AI 직원 회의 중...":"AI 전략회의 시작"}</button><p>회의 결과는 실제 실행 미션으로 분해되며 외부 게시 작업은 대표 승인을 유지합니다.</p></form>
    <section className="dy-meeting-board">
      {!result && <div className="dy-empty"><b>AI 직원들이 대기 중입니다.</b><span>대표 명령을 입력하면 시장·상품·콘텐츠·데이터·품질 관점으로 회의를 시작합니다.</span></div>}
      {error&&<div className="alert alert-error">{error}</div>}
      {result&&<><div className="dy-decision"><span>Dream Y 최종 결정 · 신뢰도 {result.confidence}%</span><h2>{result.decision}</h2><p>{result.executiveSummary}</p></div>
      <div className="dy-agent-grid">{result.agentOpinions.map(op=>{const a=DREAM_AGENTS.find(x=>x.id===op.agentId);return <article key={op.agentId}><span>{a?.icon||"🤖"}</span><div><b>{a?.name||op.agentId} · {a?.role}</b><p>{op.opinion}</p></div><strong>{op.score}</strong></article>})}</div>
      <div className="dy-missions"><h2>실행 미션</h2>{result.missions.map((m,i)=><article key={`${m.title}-${i}`}><span>{i+1}</span><div><b>{m.title}</b><p>{DREAM_AGENTS.find(a=>a.id===m.owner)?.name||m.owner} 담당 · 우선순위 {m.priority}</p>{m.approvalRequired&&<small>대표 승인 필요</small>}</div><Link href={m.action}>작업 열기</Link></article>)}</div>
      <div className="dy-risk-grid"><div><h3>안전장치</h3>{result.risks.map(x=><p key={x}>• {x}</p>)}</div><div><h3>성공 지표</h3>{result.successMetrics.map(x=><p key={x}>• {x}</p>)}</div></div></>}
    </section>
  </div>
}
