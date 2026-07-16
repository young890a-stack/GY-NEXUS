"use client";
import { useMemo, useState } from "react";
import { scoreContent } from "@/lib/quality/score";

export default function QualityWorkbench() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const result = useMemo(() => scoreContent({ title, body }), [title, body]);
  return <div className="quality-layout"><section className="panel form-grid"><div className="field"><label>제목</label><input className="input" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="검수할 제목" /></div><div className="field"><label>본문</label><textarea className="textarea quality-textarea" value={body} onChange={(e)=>setBody(e.target.value)} placeholder="블로그 또는 쇼츠 원고를 붙여넣으세요." /></div></section><aside className="panel quality-score"><div className={`score-ring ${result.publishable ? "pass" : "hold"}`}><strong>{result.total}</strong><span>/100</span></div><h2>{result.publishable ? "게시 가능" : "검수 필요"}</h2><div className="score-bars">{[["사실성",result.factuality],["가독성",result.readability],["SEO",result.seo],["브랜드",result.brand],["안전성",result.compliance]].map(([label,value])=><div key={String(label)}><span>{label}<b>{value}</b></span><i><em style={{width:`${value}%`}} /></i></div>)}</div>{result.issues.length ? <ul className="quality-issues">{result.issues.map((item)=><li key={item}>{item}</li>)}</ul> : <div className="alert alert-success">현재 기준에서 주요 위험 요소가 없습니다.</div>}</aside></div>;
}
