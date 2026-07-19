"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Provider = "coupang" | "temu";
type Overview = {
  providers: Record<Provider, { configured: boolean; candidates: number; approved: number }>;
  lastRun?: { provider: Provider; mode: string; status: string; accepted_count: number; rejected_count: number; finished_at: string; error_summary?: string } | null;
};

const categories = [
  ["1016", "가전디지털"], ["1014", "생활용품"], ["1013", "주방용품"], ["1015", "홈인테리어"],
  ["1010", "뷰티"], ["1012", "식품"], ["1017", "스포츠·레저"], ["1029", "반려동물용품"],
  ["1021", "문구·오피스"], ["1018", "자동차용품"], ["1024", "헬스·건강식품"], ["1001", "여성패션"],
] as const;

export default function AffiliateProductHub() {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>("coupang");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rejected, setRejected] = useState<Array<{ input: string; reason: string }>>([]);
  const [coupangMode, setCoupangMode] = useState<"goldbox" | "category" | "search">("goldbox");
  const [categoryId, setCategoryId] = useState("1016");
  const [keyword, setKeyword] = useState("생활 꿀템");
  const [limit, setLimit] = useState(20);
  const [temuLines, setTemuLines] = useState("");

  const loadOverview = useCallback(async () => {
    try {
      const response = await fetch("/api/affiliate/overview", { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.success) setOverview(data);
    } catch {}
  }, []);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("provider");
    if (requested === "coupang" || requested === "temu") setProvider(requested);
    void loadOverview();
  }, [loadOverview]);

  async function collectCoupang() {
    setBusy(true); setMessage(""); setError(""); setRejected([]);
    try {
      const response = await fetch("/api/affiliate/coupang/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: coupangMode, categoryId, keyword, limit }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "쿠팡 인기상품 수집에 실패했습니다.");
      setMessage(data.message);
      await loadOverview();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "쿠팡 인기상품 수집에 실패했습니다.");
    } finally { setBusy(false); }
  }

  async function importTemu() {
    setBusy(true); setMessage(""); setError(""); setRejected([]);
    try {
      const items = temuLines.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 10).map((line) => {
        const [url, title = "", priceText = ""] = line.split("|").map((value) => value.trim());
        return { url, title, priceText };
      });
      const response = await fetch("/api/affiliate/temu/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await response.json();
      setRejected(data.rejected || []);
      if (!response.ok || !data.success) throw new Error(data.message || "Temu 공유 링크 등록에 실패했습니다.");
      setMessage(data.message);
      setTemuLines("");
      await loadOverview();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Temu 공유 링크 등록에 실패했습니다.");
    } finally { setBusy(false); }
  }

  const current = overview?.providers[provider];
  return <section className="affiliate-hub">
    <div className="affiliate-hub-head">
      <div><span className="eyebrow">AFFILIATE PRODUCT SOURCING · OPERATING MODE</span><h2>인기상품 실제 수집·제휴 링크 운영</h2><p>가짜 연결 표시가 아니라, 사용할 수 있는 공식 경로로 상품을 가져와 검증하고 대표 승인 대기 목록에 저장합니다.</p></div>
      <div className="affiliate-provider-tabs">
        <button className={provider === "coupang" ? "active" : ""} onClick={() => setProvider("coupang")}>🛒 쿠팡 자동 수집</button>
        <button className={provider === "temu" ? "active" : ""} onClick={() => setProvider("temu")}>🟠 Temu 공유 링크</button>
      </div>
    </div>

    <div className="affiliate-metrics">
      <div><span>연동 방식</span><strong>{provider === "coupang" ? "승인 API" : "공유 링크"}</strong></div>
      <div><span>후보 상품</span><strong>{current?.candidates ?? "-"}</strong></div>
      <div><span>대표 승인 완료</span><strong>{current?.approved ?? "-"}</strong></div>
      <div><span>운영 준비</span><strong className={current?.configured ? "ok" : "wait"}>{current?.configured ? "준비됨" : provider === "coupang" ? "API 키 필요" : "링크 등록 필요"}</strong></div>
    </div>

    {message && <div className="connection-alert success">{message}</div>}
    {error && <div className="connection-alert error">{error}</div>}

    {provider === "coupang" ? <div className="affiliate-workbench">
      <div className="affiliate-mode-grid">
        <button className={coupangMode === "goldbox" ? "active" : ""} onClick={() => setCoupangMode("goldbox")}><strong>오늘의 특가</strong><small>골드박스 상품을 가져옵니다.</small></button>
        <button className={coupangMode === "category" ? "active" : ""} onClick={() => setCoupangMode("category")}><strong>카테고리 베스트</strong><small>선택 분야의 상위 상품을 가져옵니다.</small></button>
        <button className={coupangMode === "search" ? "active" : ""} onClick={() => setCoupangMode("search")}><strong>키워드 검색</strong><small>대표님이 노릴 상품군을 찾습니다.</small></button>
      </div>
      <div className="affiliate-fields">
        {coupangMode === "category" && <label>카테고리<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
        {coupangMode === "search" && <label>검색어<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="예: 세탁조 클리너" /></label>}
        <label>가져올 개수<select value={limit} onChange={(event) => setLimit(Number(event.target.value))}><option value={10}>10개</option><option value={20}>20개</option><option value={50}>50개</option></select></label>
      </div>
      {!current?.configured && <div className="affiliate-notice"><b>먼저 필요한 것</b><p>쿠팡 파트너스에서 API 권한이 발급된 계정의 Access Key와 Secret Key를 Vercel에 등록해야 합니다. 키가 없는 계정에서는 자동 수집을 실행하지 않습니다.</p></div>}
      <button className="button button-primary affiliate-run" onClick={collectCoupang} disabled={busy || !current?.configured}>{busy ? "실제 상품 확인 중..." : "인기상품 불러오기 · 중복 정리 · 가치 분석"}</button>
    </div> : <div className="affiliate-workbench">
      <div className="affiliate-notice good"><b>Temu는 이렇게 연결됩니다</b><p>Temu Affiliate 대시보드의 인기상품 또는 상품검색에서 ‘공유’를 눌러 만든 링크를 붙여넣습니다. Seller API, App Key, 임의 링크 템플릿은 필요 없습니다.</p></div>
      <label className="affiliate-textarea-label">공유 링크 입력 · 한 줄에 한 상품, 최대 10개
        <textarea value={temuLines} onChange={(event) => setTemuLines(event.target.value)} placeholder={"https://temu... | 상품명 | 19,900원\nhttps://temu... | 두 번째 상품명 | 9,900원"} />
      </label>
      <p className="help">상품명과 가격은 선택입니다. 공개 정보가 차단된 링크만 <b>링크 | 상품명 | 가격</b> 형식으로 보완하면 됩니다. 제휴 추적을 지키기 위해 입력한 공유 링크 원본은 그대로 보존합니다.</p>
      <button className="button button-primary affiliate-run" onClick={importTemu} disabled={busy || !temuLines.trim()}>{busy ? "링크와 상품 정보 확인 중..." : "공유 링크 검증 · 상품 저장 · 가치 분석"}</button>
      {rejected.length > 0 && <div className="affiliate-rejected"><b>제외된 링크</b>{rejected.map((item, index) => <p key={`${item.input}-${index}`}><span>{index + 1}</span>{item.reason}</p>)}</div>}
    </div>}

    <div className="affiliate-quality-bar"><span>중복 제거</span><span>출처·링크 상태 저장</span><span>데이터 신뢰도 반영</span><span>대표 승인 전 자동 게시 금지</span>{overview?.lastRun && <em>최근 실행: {overview.lastRun.status} · 성공 {overview.lastRun.accepted_count} / 제외 {overview.lastRun.rejected_count}</em>}</div>
  </section>;
}
