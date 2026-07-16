"use client";

import { useEffect, useMemo, useState } from "react";

type SearchRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
type Overview = {
  ok: boolean;
  connected: boolean;
  error?: string;
  siteUrl?: string;
  period?: { startDate: string; endDate: string };
  searchConsole?: { rows?: SearchRow[] } | null;
  searchConsoleError?: string;
  ga4?: {
    activeUsers: number;
    totalUsers: number;
    sessions: number;
    views: number;
    engagementRate: number;
    averageSessionDuration: number;
    topPages: Array<{ path: string; title: string; views: number; users: number }>;
    channels: Array<{ channel: string; sessions: number; users: number }>;
  } | null;
  ga4Error?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value || 0);
}

export default function GrowthDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/growth/overview", { cache: "no-store" });
      setData((await response.json()) as Overview);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const searchTotals = useMemo(() => {
    const rows = data?.searchConsole?.rows || [];
    return rows.reduce<{ clicks: number; impressions: number; positionWeighted: number }>(
      (acc, row) => {
        acc.clicks += Number(row.clicks || 0);
        acc.impressions += Number(row.impressions || 0);
        acc.positionWeighted += Number(row.position || 0) * Number(row.impressions || 0);
        return acc;
      },
      { clicks: 0, impressions: 0, positionWeighted: 0 }
    );
  }, [data]);

  const ctr = searchTotals.impressions ? searchTotals.clicks / searchTotals.impressions : 0;
  const position = searchTotals.impressions ? searchTotals.positionWeighted / searchTotals.impressions : 0;
  const searchRows = (data?.searchConsole?.rows || []).slice(0, 15);

  async function makeReport() {
    setReportLoading(true);
    try {
      const response = await fetch("/api/growth/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: data?.siteUrl, period: data?.period, searchConsole: data?.searchConsole, ga4: data?.ga4 }),
      });
      const json = await response.json();
      setReport(json.report || json.error || "보고서를 만들지 못했습니다.");
    } finally {
      setReportLoading(false);
    }
  }

  if (loading) return <section className="panel"><p>Search Console과 GA4 데이터를 불러오는 중입니다...</p></section>;

  if (!data?.connected) {
    return (
      <section className="panel">
        <span className="eyebrow">GOOGLE DATA CONNECTION</span>
        <h2>Google 계정 연결이 필요합니다</h2>
        <p>Search Console과 GA4를 한 번에 읽을 수 있도록 OAuth 권한을 승인합니다.</p>
        <a className="button button-primary" href="/api/search-console/start">Google 통합 연결 시작</a>
      </section>
    );
  }

  return (
    <div>
      {data.error && <div className="notice error">{data.error}</div>}
      <section className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="card stat-card"><p>검색 클릭</p><strong>{formatNumber(searchTotals.clicks)}</strong></div>
        <div className="card stat-card"><p>검색 노출</p><strong>{formatNumber(searchTotals.impressions)}</strong></div>
        <div className="card stat-card"><p>검색 CTR</p><strong>{(ctr * 100).toFixed(2)}%</strong></div>
        <div className="card stat-card"><p>평균 순위</p><strong>{position ? position.toFixed(1) : "-"}</strong></div>
      </section>

      <section className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="card stat-card"><p>활성 사용자</p><strong>{formatNumber(data.ga4?.activeUsers || 0)}</strong></div>
        <div className="card stat-card"><p>세션</p><strong>{formatNumber(data.ga4?.sessions || 0)}</strong></div>
        <div className="card stat-card"><p>페이지 조회</p><strong>{formatNumber(data.ga4?.views || 0)}</strong></div>
        <div className="card stat-card"><p>참여율</p><strong>{((data.ga4?.engagementRate || 0) * 100).toFixed(1)}%</strong></div>
      </section>

      {(data.searchConsoleError || data.ga4Error) && (
        <section className="panel" style={{ marginBottom: 24 }}>
          <h3>연결 점검</h3>
          {data.searchConsoleError && <p className="text-danger">Search Console: {data.searchConsoleError}</p>}
          {data.ga4Error && <p className="text-danger">GA4: {data.ga4Error}</p>}
          <p>환경변수와 Google OAuth 권한을 수정한 뒤 다시 연결하면 됩니다.</p>
          <a className="button button-light" href="/api/search-console/start">Google 권한 다시 승인</a>
        </section>
      )}

      <section className="grid grid-2" style={{ alignItems: "start", marginBottom: 24 }}>
        <div className="panel">
          <div className="section-heading"><div><span className="eyebrow">SEARCH CONSOLE</span><h2>상위 검색어와 페이지</h2></div><button className="button button-light" onClick={() => void load()}>새로고침</button></div>
          <div className="table-wrap"><table><thead><tr><th>검색어</th><th>페이지</th><th>클릭</th><th>노출</th><th>CTR</th><th>순위</th></tr></thead><tbody>
            {searchRows.map((row, index) => <tr key={`${row.keys?.join("|")}-${index}`}><td>{row.keys?.[0] || "-"}</td><td>{row.keys?.[1] || "-"}</td><td>{formatNumber(Number(row.clicks || 0))}</td><td>{formatNumber(Number(row.impressions || 0))}</td><td>{(Number(row.ctr || 0) * 100).toFixed(1)}%</td><td>{Number(row.position || 0).toFixed(1)}</td></tr>)}
            {!searchRows.length && <tr><td colSpan={6}>아직 검색 데이터가 없습니다.</td></tr>}
          </tbody></table></div>
        </div>

        <div className="panel">
          <span className="eyebrow">GA4</span><h2>인기 페이지</h2>
          <div className="table-wrap"><table><thead><tr><th>페이지</th><th>조회</th><th>사용자</th></tr></thead><tbody>
            {(data.ga4?.topPages || []).slice(0, 12).map((page) => <tr key={`${page.path}-${page.title}`}><td><b>{page.title}</b><br/><small>{page.path}</small></td><td>{formatNumber(page.views)}</td><td>{formatNumber(page.users)}</td></tr>)}
            {!data.ga4?.topPages?.length && <tr><td colSpan={3}>아직 GA4 데이터가 없습니다.</td></tr>}
          </tbody></table></div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">DREAM Y GROWTH REPORT</span><h2>AI 성장 분석</h2><p>실제 Search Console·GA4 데이터를 바탕으로 오늘의 실행 계획을 만듭니다.</p></div><button className="button button-primary" disabled={reportLoading} onClick={() => void makeReport()}>{reportLoading ? "분석 중..." : "Dream Y 보고서 생성"}</button></div>
        {report ? <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.75 }}>{report}</pre> : <p>버튼을 누르면 핵심 요약, 기회, 위험 신호, 오늘 할 일과 7일 계획이 생성됩니다.</p>}
      </section>
    </div>
  );
}
