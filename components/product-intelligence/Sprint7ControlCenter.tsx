"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id:string; title:string; platform:string; ai_score:number; opportunity_grade?:string; opportunity_recommendation?:string; status:string; price_text?:string; affiliate_url:string; ai_summary?:string; shorts_hook?:string; caution?:string; };

const sample = JSON.stringify([
  {
    "title": "USB-C 8포트 멀티허브",
    "platform": "coupang",
    "affiliate_url": "https://example.com/affiliate-link",
    "price_text": "39,900원",
    "category": "노트북 액세서리",
    "keyword": "USB-C 허브",
    "description": "HDMI, USB 3.0, PD 충전을 지원하는 휴대용 멀티허브",
    "demand": 84,
    "seasonality": 65,
    "priceAppeal": 77,
    "visualDemo": 91,
    "audienceFit": 90,
    "commissionPotential": 70,
    "competition": 63,
    "policyRisk": 10,
    "dataConfidence": 82
  }
], null, 2);

export default function Sprint7ControlCenter({ items }: { items: Item[] }) {
  const router = useRouter();
  const [value,setValue]=useState(sample); const [sourceName,setSourceName]=useState("approved_feed");
  const [message,setMessage]=useState(""); const [loading,setLoading]=useState(false);
  const stats=useMemo(()=>({total:items.length, top:items[0]?.ai_score||0, avg:items.length?Math.round(items.reduce((s,i)=>s+Number(i.ai_score||0),0)/items.length):0, approved:items.filter(i=>i.status==="approved").length}),[items]);
  async function collect(){setLoading(true);setMessage("");try{const parsed=JSON.parse(value);const res=await fetch("/api/product-intelligence/collect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:parsed,sourceName})});const data=await res.json();if(!res.ok)throw new Error(data.message||"수집 실패");setMessage(`${data.inserted}개 후보 수집·점수화 완료`);router.refresh();}catch(e){setMessage(e instanceof Error?e.message:"입력을 확인해주세요.");}finally{setLoading(false)}}
  async function promoteTop(){setLoading(true);setMessage("");try{const res=await fetch("/api/product-intelligence/promote-top",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({minimumScore:75,limit:10})});const data=await res.json();if(!res.ok)throw new Error(data.message||"등록 실패");setMessage(`TOP ${data.promoted}개 상품을 정식 상품으로 등록했습니다.`);router.refresh();}catch(e){setMessage(e instanceof Error?e.message:"등록 실패");}finally{setLoading(false)}}
  return <>
    <section className="panel" style={{marginBottom:24}}><span className="eyebrow">SPRINT 7 · PRODUCT INTELLIGENCE ENGINE</span><h2>상품 기회 대시보드</h2><p>승인된 제휴 피드, 직접 확보한 링크, 수동 데이터를 기반으로 판매 가능성과 콘텐츠 적합도를 점수화합니다.</p><div className="grid grid-4" style={{marginTop:18}}><div className="stat"><small>후보 상품</small><strong>{stats.total}</strong></div><div className="stat"><small>최고 점수</small><strong>{stats.top}</strong></div><div className="stat"><small>평균 점수</small><strong>{stats.avg}</strong></div><div className="stat"><small>정식 등록</small><strong>{stats.approved}</strong></div></div></section>
    <section className="panel" style={{marginBottom:24}}><div className="section-head"><div><span className="eyebrow">TREND COLLECTOR</span><h2>상품 후보 일괄 수집</h2><p>실시간 무단 크롤링이 아니라 공식 API·승인 피드·대표님이 확보한 제휴 링크를 입력하는 안전한 방식입니다.</p></div></div>{message&&<div className={message.includes("완료")||message.includes("등록")?"alert alert-success":"alert alert-error"} style={{marginBottom:16}}>{message}</div>}<div className="field"><label>수집 출처 이름</label><input className="input" value={sourceName} onChange={e=>setSourceName(e.target.value)} /></div><textarea className="textarea" style={{minHeight:300,fontFamily:"monospace"}} value={value} onChange={e=>setValue(e.target.value)} spellCheck={false}/><div className="actions" style={{marginTop:14}}><button className="button button-primary" onClick={collect} disabled={loading}>{loading?"처리 중...":"후보 수집·AI 기회점수 계산"}</button><button className="button button-success" onClick={promoteTop} disabled={loading}>75점 이상 TOP10 정식 등록</button><button className="button button-light" onClick={()=>setValue(sample)} disabled={loading}>예시 복원</button></div></section>
    <section className="grid">{items.length===0?<div className="panel empty">아직 후보가 없습니다.</div>:items.map((item,index)=><article className="panel" key={item.id}><div className="badges"><span className="badge">#{index+1}</span><span className="badge">{item.platform}</span><span className="badge">{item.status}</span><span className="badge">{item.opportunity_grade||"-"}등급</span></div><div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-start"}}><div><h2>{item.title}</h2><p>{item.ai_summary||"분석 내용 없음"}</p></div><div className="analysis-score"><small>기회점수</small><strong>{item.ai_score||0}</strong><span>/100</span></div></div><div className="analysis-highlight-grid"><div><small>추천</small><strong>{item.opportunity_recommendation||"검토"}</strong></div><div><small>쇼츠 훅</small><strong>{item.shorts_hook||"-"}</strong></div></div><p className="help">{item.caution||"현재 입력 기준 주요 위험 없음"}</p><div className="actions"><a className="button button-primary" href={`/admin/content?product=${encodeURIComponent(item.title)}`}>콘텐츠 만들기</a><a className="button button-light" href={item.affiliate_url} target="_blank" rel="noreferrer">상품 링크</a></div></article>)}</section>
  </>;
}
