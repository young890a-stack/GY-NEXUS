"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const sample = JSON.stringify([
  {
    title: "상품명",
    platform: "coupang",
    affiliate_url: "https://example.com/affiliate-link",
    price_text: "29,900원",
    description: "핵심 특징과 사양",
    demand: 80,
    seasonality: 70,
    priceAppeal: 75,
    visualDemo: 90,
    audienceFit: 85,
    commissionPotential: 65,
    competition: 55,
    policyRisk: 15,
    dataConfidence: 80
  }
], null, 2);

export default function BatchOpportunityImporter() {
  const router = useRouter();
  const [value, setValue] = useState(sample);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true); setMessage("");
    try {
      const candidates = JSON.parse(value);
      const response = await fetch("/api/product-intelligence/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidates }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "분석 실패");
      setMessage(`${data.inserted}개 상품의 GY 기회점수 분석을 완료했습니다.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "입력 형식을 확인해주세요."); }
    finally { setLoading(false); }
  }

  return <section className="panel" style={{ marginBottom: 24 }}>
    <div className="section-head"><div><span className="eyebrow">SPRINT 2 · BATCH OPPORTUNITY ENGINE</span><h2>쿠팡·Temu 상품 후보 일괄 분석</h2><p>공식 API·제휴 피드·직접 확보한 상품 후보를 JSON으로 붙여넣으면 수요, 경쟁, 영상 적합성, 정책 위험을 계산합니다.</p></div></div>
    {message && <div className={message.includes("완료") ? "alert alert-success" : "alert alert-error"} style={{marginBottom:16}}>{message}</div>}
    <textarea className="textarea" style={{minHeight:360,fontFamily:"monospace"}} value={value} onChange={(e)=>setValue(e.target.value)} spellCheck={false}/>
    <div className="actions" style={{marginTop:14}}><button className="button button-primary" onClick={run} disabled={loading}>{loading ? "기회점수 계산 중..." : "GY 기회점수 일괄 계산"}</button><button className="button button-light" onClick={()=>setValue(sample)} disabled={loading}>예시 복원</button></div>
    <p className="help">점수는 판매 보장이 아니라 우선순위 판단용입니다. 쿠팡·Temu의 승인된 API·피드 또는 대표님이 확보한 제휴 링크만 사용하세요.</p>
  </section>;
}
