"use client";

import { FormEvent, useState } from "react";

type Plan = {
  status: string;
  scores: { opportunity: number; dataConfidence: number; contentFit: number; thumbnailFit: number };
  reasons: string[];
  contentPlan: {
    blog: { angle: string; sections: string[] };
    shorts: { duration: number; structure: string[]; subtitle: string };
    thumbnail: { concept: string; palette: string; composition: string; headline: string; platformFit: string; qualityGate: string[] };
  };
  gates: Record<string, string>;
};

export default function CompanyOSV2Page() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setMessage(""); setPlan(null);
    const form = new FormData(event.currentTarget);
    const facts = String(form.get("facts") || "").split("\n").map(v => v.trim()).filter(Boolean);
    try {
      const response = await fetch("/api/v2/pipeline/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"), category: form.get("category"), platform: form.get("platform"),
          priceText: form.get("priceText"), affiliateUrl: form.get("affiliateUrl"), targetAudience: "20~40대 실용 소비자", productFacts: facts,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "실행 실패");
      setPlan(data.plan);
    } catch (error) { setMessage(error instanceof Error ? error.message : "실행에 실패했습니다."); }
    finally { setLoading(false); }
  }

  return <main className="admin-page">
    <section className="admin-hero">
      <span className="eyebrow">GY-NEXUS AI COMPANY OS v2.0 · SPRINT 1</span>
      <h1>One Reliable Pipeline</h1>
      <p>상품 하나를 근거 기반으로 분석하고, 블로그·쇼츠·썸네일 전략과 게시 잠금 조건까지 한 번에 설계합니다.</p>
    </section>

    <section className="admin-card">
      <form onSubmit={submit} className="settings-grid">
        <label>상품명<input name="title" required placeholder="예: Samsung Galaxy Tab S10 FE" /></label>
        <label>카테고리<input name="category" placeholder="예: 태블릿 / IT" /></label>
        <label>수집 출처<select name="platform" defaultValue="manual"><option value="manual">직접 입력</option><option value="coupang">쿠팡 연결 예정</option><option value="temu">Temu 연결 예정</option></select></label>
        <label>가격 정보<input name="priceText" placeholder="검증한 가격만 입력" /></label>
        <label className="full">제휴 링크<input name="affiliateUrl" placeholder="https://..." /></label>
        <label className="full">검증 가능한 상품 사실<textarea name="facts" rows={5} placeholder={"한 줄에 하나씩 입력\n예: 10.9인치 디스플레이\n예: 공식 보증 지원"} /></label>
        <div className="full"><button className="button button-primary" disabled={loading}>{loading ? "Dream Y 분석 중..." : "대표 검토안 생성"}</button></div>
      </form>
      {message && <p>{message}</p>}
    </section>

    {plan && <>
      <section className="metric-grid">
        {Object.entries(plan.scores).map(([key, value]) => <article className="metric-card" key={key}><span>{key}</span><strong>{value}</strong><small>/ 100</small></article>)}
      </section>
      <section className="admin-grid two-columns">
        <article className="admin-card"><span className="eyebrow">DECISION</span><h2>{plan.status}</h2>{plan.reasons.map(reason => <p key={reason}>• {reason}</p>)}</article>
        <article className="admin-card"><span className="eyebrow">QUALITY GATES</span>{Object.entries(plan.gates).map(([key, value]) => <p key={key}><strong>{key}</strong> · {value}</p>)}</article>
      </section>
      <section className="admin-grid two-columns">
        <article className="admin-card"><span className="eyebrow">CONTENT PLAN</span><h2>블로그 + {plan.contentPlan.shorts.duration}초 쇼츠</h2><p>{plan.contentPlan.blog.angle}</p>{plan.contentPlan.blog.sections.map(item => <p key={item}>• {item}</p>)}</article>
        <article className="admin-card"><span className="eyebrow">THUMBNAIL INTELLIGENCE</span><h2>{plan.contentPlan.thumbnail.headline}</h2><p><strong>콘셉트</strong> · {plan.contentPlan.thumbnail.concept}</p><p><strong>색상</strong> · {plan.contentPlan.thumbnail.palette}</p><p><strong>구도</strong> · {plan.contentPlan.thumbnail.composition}</p><p>{plan.contentPlan.thumbnail.platformFit}</p>{plan.contentPlan.thumbnail.qualityGate.map(item => <p key={item}>□ {item}</p>)}</article>
      </section>
    </>}
  </main>;
}
