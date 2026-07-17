"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "analyzed" | "approved" | "held" | "rejected";
type Item = {
  id: string; title: string; platform: string; ai_score: number; opportunity_grade?: string;
  opportunity_recommendation?: string; status: Status; price_text?: string; affiliate_url: string;
  ai_summary?: string; shorts_hook?: string; caution?: string; collected_at?: string;
};

const sample = JSON.stringify([{ title: "USB-C 8포트 멀티허브", platform: "coupang", affiliate_url: "https://example.com/affiliate-link", price_text: "39,900원", category: "노트북 액세서리", keyword: "USB-C 허브", description: "HDMI, USB 3.0, PD 충전을 지원하는 휴대용 멀티허브", demand: 84, seasonality: 65, priceAppeal: 77, visualDemo: 91, audienceFit: 90, commissionPotential: 70, competition: 63, policyRisk: 10, dataConfidence: 82 }], null, 2);

export default function ProductIntelligenceControlCenter({ items }: { items: Item[] }) {
  const router = useRouter();
  const [value, setValue] = useState(sample);
  const [sourceName, setSourceName] = useState("approved_affiliate_feed");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const stats = useMemo(() => ({
    total: items.length,
    top: items[0]?.ai_score || 0,
    avg: items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.ai_score || 0), 0) / items.length) : 0,
    waiting: items.filter((item) => item.status === "analyzed").length,
    approved: items.filter((item) => item.status === "approved").length,
  }), [items]);
  const visible = filter === "all" ? items : items.filter((item) => item.status === filter);

  async function collect() {
    setLoading(true); setMessage("");
    try {
      const parsed = JSON.parse(value);
      const response = await fetch("/api/product-intelligence/collect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: parsed, sourceName }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "수집 실패");
      setMessage(`${data.inserted}개 후보 수집·점수화 완료`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "입력을 확인해주세요."); }
    finally { setLoading(false); }
  }

  async function decide(id: string, decision: "approved" | "held" | "rejected") {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/product-intelligence/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "처리 실패");
      setMessage(decision === "approved" ? "정식 상품으로 등록했습니다." : decision === "held" ? "보류 목록으로 이동했습니다." : "후보에서 제외했습니다.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리 실패"); }
    finally { setLoading(false); }
  }

  async function promoteTop() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/product-intelligence/promote-top", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minimumScore: 75, limit: 10 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "등록 실패");
      setMessage(`TOP ${data.promoted}개 상품을 정식 상품으로 등록했습니다.`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "등록 실패"); }
    finally { setLoading(false); }
  }

  return <>
    <section className="panel" style={{ marginBottom: 24 }}>
      <span className="eyebrow">SPRINT 2 · PRODUCT INTELLIGENCE ENGINE</span><h2>상품 기회 대시보드</h2>
      <p>공식 API, 승인된 제휴 피드, 대표님이 확보한 링크를 안전하게 입력해 상품성을 분석합니다. 무단 크롤링은 포함하지 않습니다.</p>
      <div className="grid grid-4" style={{ marginTop: 18 }}>
        <div className="stat"><small>후보 상품</small><strong>{stats.total}</strong></div><div className="stat"><small>최고 점수</small><strong>{stats.top}</strong></div>
        <div className="stat"><small>평균 점수</small><strong>{stats.avg}</strong></div><div className="stat"><small>승인 대기</small><strong>{stats.waiting}</strong></div>
      </div>
      <div className="help" style={{ marginTop: 12 }}>정식 등록 상품: {stats.approved}개</div>
    </section>

    <section className="panel" style={{ marginBottom: 24 }}>
      <div className="section-head"><div><span className="eyebrow">TREND COLLECTOR</span><h2>상품 후보 수집·분석</h2><p>JSON 배열로 여러 상품을 한 번에 등록하면 중복 제거, 점수화, 추천 사유와 위험요소를 저장합니다.</p></div></div>
      {message && <div className={message.includes("실패") || message.includes("확인") ? "alert alert-error" : "alert alert-success"} style={{ marginBottom: 16 }}>{message}</div>}
      <div className="field"><label>수집 출처 이름</label><input className="input" value={sourceName} onChange={(event) => setSourceName(event.target.value)} /></div>
      <textarea className="textarea" style={{ minHeight: 300, fontFamily: "monospace" }} value={value} onChange={(event) => setValue(event.target.value)} spellCheck={false} />
      <div className="actions" style={{ marginTop: 14 }}><button className="button button-primary" onClick={collect} disabled={loading}>{loading ? "처리 중..." : "후보 수집·기회점수 계산"}</button><button className="button button-success" onClick={promoteTop} disabled={loading}>75점 이상 TOP10 일괄 승인</button><button className="button button-light" onClick={() => setValue(sample)} disabled={loading}>예시 복원</button></div>
    </section>

    <section className="panel" style={{ marginBottom: 24 }}><div className="actions">{(["all", "analyzed", "approved", "held", "rejected"] as const).map((status) => <button key={status} className={filter === status ? "button button-primary" : "button button-light"} onClick={() => setFilter(status)}>{status === "all" ? "전체" : status === "analyzed" ? "승인 대기" : status === "approved" ? "승인" : status === "held" ? "보류" : "제외"}</button>)}</div></section>

    <section className="grid">{visible.length === 0 ? <div className="panel empty">해당 상태의 상품이 없습니다.</div> : visible.map((item, index) => <article className="panel" key={item.id}>
      <div className="badges"><span className="badge">#{index + 1}</span><span className="badge">{item.platform}</span><span className="badge">{item.status}</span><span className="badge">{item.opportunity_grade || "-"}등급</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}><div><h2>{item.title}</h2><p>{item.ai_summary || "분석 내용 없음"}</p><small>{item.price_text || "가격 미입력"}</small></div><div className="analysis-score"><small>기회점수</small><strong>{item.ai_score || 0}</strong><span>/100</span></div></div>
      <div className="analysis-highlight-grid"><div><small>추천</small><strong>{item.opportunity_recommendation || "검토"}</strong></div><div><small>쇼츠 훅</small><strong>{item.shorts_hook || "-"}</strong></div></div>
      <p className="help">{item.caution || "현재 입력 기준 주요 위험 없음"}</p>
      <div className="actions">{item.status !== "approved" && <button className="button button-success" disabled={loading} onClick={() => decide(item.id, "approved")}>승인·정식 등록</button>}{item.status !== "held" && <button className="button button-light" disabled={loading} onClick={() => decide(item.id, "held")}>보류</button>}{item.status !== "rejected" && <button className="button button-light" disabled={loading} onClick={() => decide(item.id, "rejected")}>제외</button>}<a className="button button-primary" href={`/admin/content?product=${encodeURIComponent(item.title)}`}>콘텐츠 만들기</a><a className="button button-light" href={item.affiliate_url} target="_blank" rel="noreferrer">상품 링크</a></div>
    </article>)}</section>
  </>;
}
