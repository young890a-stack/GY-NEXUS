"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Overview = {
  ok: boolean;
  readiness: number;
  generatedAt: string;
  services: Array<{ key: string; name: string; ready: boolean; purpose: string }>;
  metrics: {
    products: number;
    contents: number;
    creatives: number;
    seoReports: number;
    publishPending: number;
    automationPending: number;
    automationFailed: number;
  };
  nextActions: string[];
};

const operatingFlow = [
  ["1", "기회 탐색", "팔 가능성이 높은 상품을 선정", "/admin/product-intelligence"],
  ["2", "콘텐츠 생산", "블로그·쇼츠·SEO 패키지 생성", "/admin/content-factory"],
  ["3", "크리에이티브", "상품 이미지와 세로 영상을 제작", "/admin/creative-studio"],
  ["4", "자동 실행", "작업 큐로 생성·게시 흐름 실행", "/admin/automation"],
  ["5", "성과 개선", "검색·방문 데이터를 분석", "/admin/growth"],
] as const;

export default function CompanyOSCommandCenter() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState("");
  const [briefLoading, setBriefLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/company-os/overview", { cache: "no-store" });
      setOverview(await response.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createBrief() {
    if (!overview) return;
    setBriefLoading(true);
    try {
      const response = await fetch("/api/company-os/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overview }),
      });
      const result = await response.json();
      setBrief(result.report || result.error || "브리핑을 만들지 못했습니다.");
    } finally {
      setBriefLoading(false);
    }
  }

  if (loading) return <section className="panel"><p>AI Company OS 상태를 점검하는 중입니다...</p></section>;
  if (!overview) return <section className="panel"><p>운영 현황을 불러오지 못했습니다.</p></section>;

  return (
    <div className="company-os-stack">
      <section className="company-os-readiness panel">
        <div>
          <span className="eyebrow">OPERATING READINESS</span>
          <h2>운영 준비도 {overview.readiness}%</h2>
          <p>외부 연결, 데이터 테이블과 자동화 상태를 종합한 현재 준비도입니다.</p>
        </div>
        <div className="company-os-gauge" aria-label={`운영 준비도 ${overview.readiness}%`}>
          <strong>{overview.readiness}</strong><span>/100</span>
        </div>
      </section>

      <section className="grid grid-4 company-os-metrics">
        <div className="card stat-card"><p>상품</p><strong>{overview.metrics.products}</strong></div>
        <div className="card stat-card"><p>콘텐츠</p><strong>{overview.metrics.contents}</strong></div>
        <div className="card stat-card"><p>제작물</p><strong>{overview.metrics.creatives}</strong></div>
        <div className="card stat-card"><p>SEO 보고서</p><strong>{overview.metrics.seoReports}</strong></div>
        <div className="card stat-card"><p>게시 대기</p><strong>{overview.metrics.publishPending}</strong></div>
        <div className="card stat-card"><p>자동화 대기</p><strong>{overview.metrics.automationPending}</strong></div>
        <div className="card stat-card"><p>자동화 실패</p><strong>{overview.metrics.automationFailed}</strong></div>
        <div className="card stat-card"><p>외부 연결</p><strong>{overview.services.filter((item) => item.ready).length}/{overview.services.length}</strong></div>
      </section>

      <section className="grid grid-2" style={{ alignItems: "start" }}>
        <article className="panel">
          <div className="section-heading"><div><span className="eyebrow">COMPANY PIPELINE</span><h2>회사를 움직이는 5단계</h2></div><Link className="button button-light" href="/admin/automation">자동화 열기</Link></div>
          <div className="company-os-flow">
            {operatingFlow.map(([step, title, description, href]) => (
              <Link href={href} key={step} className="company-os-flow-item">
                <span>{step}</span><div><strong>{title}</strong><p>{description}</p></div>
              </Link>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="section-heading"><div><span className="eyebrow">SERVICE HEALTH</span><h2>핵심 연결 상태</h2></div><Link href="/admin/connections">연결센터 →</Link></div>
          <div className="service-list">
            {overview.services.map((service) => (
              <div className="service-row" key={service.key}>
                <span><b>{service.name}</b><small>{service.purpose}</small></span>
                <b className={service.ready ? "ready" : "pending"}>{service.ready ? "준비됨" : "설정 필요"}</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-2" style={{ alignItems: "start" }}>
        <article className="panel">
          <span className="eyebrow">TODAY&apos;S CONTROL LIST</span><h2>대표 확인 항목</h2>
          <ol className="company-os-actions">{overview.nextActions.map((item) => <li key={item}>{item}</li>)}</ol>
          <div className="actions"><Link className="button button-primary" href="/admin/publishing">게시 대기열</Link><Link className="button button-light" href="/admin/growth">성과 분석</Link></div>
        </article>

        <article className="panel">
          <div className="section-heading"><div><span className="eyebrow">DREAM Y CEO BRIEF</span><h2>대표 브리핑</h2></div><button className="button button-primary" disabled={briefLoading} onClick={() => void createBrief()}>{briefLoading ? "작성 중..." : "오늘 브리핑 생성"}</button></div>
          {brief ? <pre className="company-os-brief">{brief}</pre> : <p>운영 상태와 작업 대기열을 바탕으로 오늘의 우선순위와 7일 목표를 만듭니다.</p>}
        </article>
      </section>
    </div>
  );
}
