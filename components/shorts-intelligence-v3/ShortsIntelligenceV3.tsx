"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./ShortsIntelligenceV3.module.css";

type Dashboard = {
  runs: Array<Record<string, any>>;
  candidates: Array<Record<string, any>>;
  opportunities: Array<Record<string, any>>;
  variants: Array<Record<string, any>>;
};

const emptyDashboard: Dashboard = { runs: [], candidates: [], opportunities: [], variants: [] };

export default function ShortsIntelligenceV3() {
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/shorts-intelligence-v3/dashboard", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "운영현황을 불러오지 못했습니다.");
      setDashboard(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "운영현황을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createRun(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/shorts-intelligence-v3/discovery-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, targetCandidateCount: 150, platforms: ["douyin", "xiaohongshu"] }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "수집 작업 생성 실패");
      setMessage("수집 작업을 만들었습니다. 로그인 계정 수집 도우미가 보이는 카드만 안전하게 여러 페이지에서 보내도록 연결하세요.");
      setQuery("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "수집 작업 생성 실패");
    } finally {
      setBusy(false);
    }
  }

  const verified30 = useMemo(() => dashboard.opportunities.filter((item) => item.high_commission_eligible), [dashboard.opportunities]);
  const topCandidates = dashboard.candidates.slice(0, 6);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span>GY-NEXUS V3</span>
          <h1>Shorts Intelligence & Profit Engine</h1>
          <p>인기 영상 수집, 30% 이상 검증 수수료, 예상 순이익, 3개 쇼츠 변형, 90점 품질 차단을 한 화면에서 관리합니다.</p>
        </div>
        <button className={styles.refresh} onClick={() => void load()} disabled={loading}>{loading ? "불러오는 중" : "새로고침"}</button>
      </header>

      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.metrics}>
        <article><b>{dashboard.runs.length}</b><span>최근 수집 작업</span></article>
        <article><b>{dashboard.candidates.length}</b><span>상위 분석 후보</span></article>
        <article><b>{verified30.length}</b><span>검증된 30%+ 후보</span></article>
        <article><b>{dashboard.variants.length}</b><span>쇼츠 변형 작업</span></article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><span>STEP 1</span><h2>대량 수집 작업 시작</h2></div>
          <small>원본 다운로드가 아니라 로그인 화면에 보이는 공개 카드 메타데이터만 수집</small>
        </div>
        <form className={styles.searchForm} onSubmit={createRun}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 휴대용 냉풍기, 세탁조 클리너" minLength={2} required />
          <button disabled={busy}>{busy ? "생성 중" : "후보 150개 수집 준비"}</button>
        </form>
      </section>

      <section className={styles.columns}>
        <div className={styles.panel}>
          <div className={styles.panelHead}><div><span>INTELLIGENCE</span><h2>상위 영상 후보</h2></div></div>
          <div className={styles.list}>
            {topCandidates.map((item) => (
              <article className={styles.candidate} key={item.id}>
                <div className={styles.thumb}>{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" /> : <span>{item.platform}</span>}</div>
                <div><b>{item.title || "제목 없음"}</b><p>{item.platform} · 종합 {item.total_intelligence_score}점 · 인기 {item.popularity_score}점</p></div>
              </article>
            ))}
            {!topCandidates.length && <p className={styles.empty}>아직 수집된 후보가 없습니다.</p>}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}><div><span>PROFIT</span><h2>30% 이상 검증 상품</h2></div></div>
          <div className={styles.list}>
            {verified30.slice(0, 6).map((item) => (
              <article className={styles.profit} key={item.id}>
                <div><b>{item.products?.title || item.affiliate_platform}</b><p>수수료 {item.commission_rate}% · 순이익 예상 {Number(item.expected_net_profit || 0).toLocaleString("ko-KR")}원</p></div>
                <strong>{item.profit_score}점</strong>
              </article>
            ))}
            {!verified30.length && <p className={styles.empty}>수수료 근거가 확인된 30% 이상 상품이 아직 없습니다.</p>}
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>QUALITY GATE</span><h2>3개 쇼츠 변형 제작 원칙</h2></div></div>
        <div className={styles.variantGrid}>
          <article><b>A</b><h3>문제 해결형</h3><p>첫 2초 문제 장면 → 해결 증명 → 자연스러운 CTA</p></article>
          <article><b>B</b><h3>시각 충격형</h3><p>놀라운 사용 장면 → 핵심 효용 → 구매 이유</p></article>
          <article><b>C</b><h3>비교 증명형</h3><p>기존 방식과 비교 → 결과 확인 → 선택 근거</p></article>
        </div>
        <div className={styles.gate}>종합 90점 미만 · 상품 불일치 · 저작권 위험 · 자막 오류가 있으면 게시를 자동 차단합니다.</div>
      </section>
    </div>
  );
}
