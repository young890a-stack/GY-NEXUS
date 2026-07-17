"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Channel = { name:string; revenue:number; views:number; clicks:number; conversions:number; color:string };
type Recommendation = { title:string; reason:string; score:number; channel:string; publishAt:string; predictedCtr:number; predictedRevenue:number };
type Summary = {
  source:"database"|"demo";
  totals:{ revenue:number; views:number; clicks:number; conversions:number; ctr:number; conversionRate:number; publishSuccessRate:number };
  channels:Channel[];
  trend:{ label:string; revenue:number; views:number }[];
  recommendations:Recommendation[];
  forecast:{ revenue:number; views:number; ctr:number; confidence:number };
  recent:{ title:string; channel:string; views:number; ctr:number; revenue:number; status:string }[];
};

const won = new Intl.NumberFormat("ko-KR", { style:"currency", currency:"KRW", maximumFractionDigits:0 });
const integer = new Intl.NumberFormat("ko-KR");

function Sparkline({ values }:{ values:number[] }) {
  const max=Math.max(...values,1), min=Math.min(...values,0), range=Math.max(max-min,1);
  const points=values.map((v,i)=>`${(i/(values.length-1))*100},${34-((v-min)/range)*30}`).join(" ");
  return <svg className="s6-spark" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><polyline points={points}/></svg>;
}

export default function RevenueDashboard() {
  const [data,setData]=useState<Summary|null>(null);
  const [period,setPeriod]=useState("30d");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ setLoading(true); fetch(`/api/revenue/summary?period=${period}`).then(r=>r.json()).then(setData).catch(()=>setData(null)).finally(()=>setLoading(false)); },[period]);
  const maxChannel=useMemo(()=>Math.max(...(data?.channels.map(c=>c.revenue)||[1]),1),[data]);
  if (loading || !data) return <div className="s6-loading">Dream Y가 성과 데이터를 분석하고 있습니다…</div>;
  const kpis=[
    ["총 수익",won.format(data.totals.revenue),"+18.7%",data.trend.map(x=>x.revenue)],
    ["총 조회수",integer.format(data.totals.views),"+21.3%",data.trend.map(x=>x.views)],
    ["평균 CTR",`${data.totals.ctr.toFixed(1)}%`,`+3.2%p`,data.trend.map((x,i)=>x.views?x.revenue/x.views:0)],
    ["전환율",`${data.totals.conversionRate.toFixed(1)}%`,`+1.1%p`,data.trend.map((_,i)=>1+i*.2)],
    ["게시 성공률",`${data.totals.publishSuccessRate.toFixed(1)}%`,`+0.8%p`,data.trend.map((_,i)=>95+i*.5)],
  ];
  return <div className="s6-dashboard">
    <header className="s6-page-head">
      <div><span>SPRINT 6 · EXECUTIVE INTELLIGENCE</span><h1>Revenue Dashboard</h1><p>수익·콘텐츠·채널 데이터를 하나의 경영 화면에서 판단합니다.</p></div>
      <div className="s6-head-actions"><span className={`s6-source ${data.source}`}>{data.source==="database"?"LIVE DATA":"DEMO DATA"}</span><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="7d">최근 7일</option><option value="30d">최근 30일</option><option value="90d">최근 90일</option></select></div>
    </header>

    <section className="s6-kpi-grid">{kpis.map(([label,value,delta,vals])=><article key={String(label)}><span>{label as string}</span><strong>{value as string}</strong><small>▲ {delta as string}</small><Sparkline values={vals as number[]}/></article>)}</section>

    <section className="s6-main-grid">
      <article className="s6-panel s6-trend"><div className="s6-panel-head"><div><span>REVENUE TREND</span><h2>기간별 수익 추이</h2></div><b>{won.format(data.forecast.revenue)} 예상</b></div><div className="s6-bars">{data.trend.map((x,i)=><div key={x.label}><i style={{height:`${Math.max(10,(x.revenue/Math.max(...data.trend.map(t=>t.revenue),1))*100)}%`}}/><small>{x.label}</small></div>)}</div></article>
      <article className="s6-panel"><div className="s6-panel-head"><div><span>CHANNEL MIX</span><h2>채널별 수익 비중</h2></div></div><div className="s6-channel-list">{data.channels.map(c=><div key={c.name}><div><strong>{c.name}</strong><small>{won.format(c.revenue)} · CTR {c.views?((c.clicks/c.views)*100).toFixed(1):"0.0"}%</small></div><span><i style={{width:`${(c.revenue/maxChannel)*100}%`}}/></span></div>)}</div></article>
      <article className="s6-panel s6-advisor"><div className="s6-panel-head"><div><span>AI ADVISOR</span><h2>오늘의 실행 추천</h2></div><Link href="/admin/ai-advisor">전체 보기 ↗</Link></div>{data.recommendations.slice(0,3).map((r,i)=><div className="s6-rec" key={r.title}><em>{i+1}</em><div><strong>{r.title}</strong><p>{r.reason}</p><small>{r.channel} · {r.publishAt} · 예상 CTR {r.predictedCtr}%</small></div><b>{r.score}</b></div>)}</article>
    </section>

    <section className="s6-bottom-grid">
      <article className="s6-panel"><div className="s6-panel-head"><div><span>RECENT CONTENT</span><h2>최근 게시 콘텐츠</h2></div><Link href="/admin/publishing">게시센터 ↗</Link></div><div className="s6-table"><div className="head"><span>콘텐츠</span><span>채널</span><span>조회수</span><span>CTR</span><span>수익</span><span>상태</span></div>{data.recent.map(x=><div key={x.title}><strong>{x.title}</strong><span>{x.channel}</span><span>{integer.format(x.views)}</span><span>{x.ctr.toFixed(1)}%</span><span>{won.format(x.revenue)}</span><em>{x.status}</em></div>)}</div></article>
      <article className="s6-panel s6-forecast-card"><span>FORECAST ENGINE</span><h2>{won.format(data.forecast.revenue)}</h2><p>다음 기간 예상 수익</p><div><b>예상 조회수</b><strong>{integer.format(data.forecast.views)}</strong></div><div><b>예상 CTR</b><strong>{data.forecast.ctr}%</strong></div><div><b>신뢰도</b><strong>{data.forecast.confidence}%</strong></div><Link href="/admin/forecast">예측 상세 보기 ↗</Link></article>
    </section>
  </div>;
}
