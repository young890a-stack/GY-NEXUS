"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import styles from "./GrowthCommerceEngine.module.css";

type Trend = { keyword: string; traffic: number; shopping_fit: number; rank: number; observed_at: string };
type Video = { video_id: string; title: string; views: number; average_view_percentage: number; attributed_clicks: number; conversions: number; revenue: number; commerce_score: number };
type Rule = { rule_key: string; segment: string; direction: string; score: number; lift_percent: number; sample_size: number; confidence: number; active: boolean; recommendation: string };
type Status = { success: boolean; setupRequired?: boolean; message?: string; canva: { configured: boolean; connected: boolean }; youtube: { configured: boolean; connected: boolean }; counts?: { renderedProjects: number; v34Variants: number }; trends: Trend[]; videos: Video[]; rules: Rule[] };

const pipeline = [
  ["01", "TREND", "Google Trends", "대한민국 급상승 수요를 상품 기회로 변환"],
  ["02", "PRODUCT", "상품 인텔리전스", "쿠팡·Temu 상품과 수익 가능성 연결"],
  ["03", "CREATE", "V3-4 쇼츠 품질", "훅·장면·자막·품질검수·다중 버전"],
  ["04", "DESIGN", "Canva 편집", "AI 썸네일을 모바일에서 마지막 수정"],
  ["05", "EDIT", "CapCut 패키지", "MP4·SRT·대본·게시문구를 ZIP으로 전달"],
  ["06", "PUBLISH", "YouTube", "자동 게시 후 시청·구독·클릭·판매 동기화"],
  ["07", "LEARN", "판매 학습", "잘 팔린 훅·길이·제목을 다음 제작에 반영"],
];

function number(value: number) { return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(Number(value) || 0); }

export default function GrowthCommerceEngine() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [variantId, setVariantId] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailTitle, setThumbnailTitle] = useState("GY-NEXUS 쇼츠 썸네일");
  const [productId, setProductId] = useState("");
  const [contentKey, setContentKey] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/growth-commerce/status", { cache: "no-store" });
      const data = await response.json() as Status;
      setStatus(data);
      if (data.message) setMessage(data.message);
    } catch { setError("V3-5 상태를 불러오지 못했습니다."); }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "canva") setMessage("Canva 연결이 완료되었습니다.");
    if (params.get("error")) setError(`Canva 연결 오류: ${params.get("error")}`);
    void load();
  }, [load]);

  async function run(endpoint: string, key: string, method = "POST") {
    setBusy(key); setError(""); setMessage("");
    try {
      const response = await fetch(endpoint, { method });
      const data = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || data.success === false) throw new Error(data.message || "실행 실패");
      setMessage(data.message || "완료했습니다.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "실행 실패"); }
    finally { setBusy(""); }
  }

  async function downloadCapcut() {
    if (!variantId.trim()) return setError("V3-4 제작안 ID를 입력해주세요.");
    setBusy("capcut"); setError("");
    try {
      const response = await fetch("/api/growth-commerce/capcut-package", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId: variantId.trim() }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.message || "패키지 생성 실패"); }
      const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "GY-NEXUS-CapCut-Package.zip"; link.click(); URL.revokeObjectURL(link.href); setMessage("CapCut 가져오기 패키지를 만들었습니다.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "패키지 생성 실패"); }
    finally { setBusy(""); }
  }

  async function createCanva() {
    if (!thumbnailUrl.startsWith("https://")) return setError("완성된 HTTPS 썸네일 이미지 주소를 입력해주세요.");
    setBusy("canva"); setError("");
    try {
      const response = await fetch("/api/growth-commerce/canva/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: thumbnailUrl, title: thumbnailTitle, format: "shorts" }) });
      const data = await response.json() as { success?: boolean; editUrl?: string; message?: string };
      if (!response.ok || !data.editUrl) throw new Error(data.message || "Canva 생성 실패");
      window.open(data.editUrl, "_blank", "noopener,noreferrer"); setMessage("Canva 편집 화면을 열었습니다.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Canva 생성 실패"); }
    finally { setBusy(""); }
  }

  async function makeTrackingLink() {
    if (!productId.trim()) return setError("상품 ID를 입력해주세요.");
    setBusy("link"); setError("");
    try {
      const response = await fetch("/api/growth-commerce/tracking-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, contentKey, channel: "youtube" }) });
      const data = await response.json() as { success?: boolean; url?: string; message?: string };
      if (!response.ok || !data.url) throw new Error(data.message || "링크 생성 실패");
      setTrackingUrl(data.url); await navigator.clipboard.writeText(data.url).catch(() => undefined); setMessage("판매 추적 링크를 생성하고 복사했습니다.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "링크 생성 실패"); }
    finally { setBusy(""); }
  }

  const topVideo = useMemo(() => status?.videos?.[0], [status]);

  return <div className={styles.page}>
    <header className={styles.hero}>
      <div><span>GY-NEXUS V3.5 · GROWTH COMMERCE ENGINE</span><h1>조회수가 아니라<br/><b>실제 판매를 학습합니다.</b></h1><p>트렌드 발견부터 쇼츠 제작, Canva·CapCut, YouTube 게시, 제휴 클릭과 구매 성과까지 하나의 운영 흐름으로 연결합니다.</p></div>
      <aside><small>ENGINE STATUS</small><strong>{status?.setupRequired ? "SQL 적용 필요" : "READY"}</strong><p>{status?.message || "시스템 확인 중"}</p><button onClick={() => void load()}>상태 새로고침</button></aside>
    </header>

    <section className={styles.pipeline}>{pipeline.map((item, index) => <article key={item[0]}><i>{item[0]}</i><small>{item[1]}</small><h2>{item[2]}</h2><p>{item[3]}</p>{index < pipeline.length - 1 && <b>→</b>}</article>)}</section>

    {(message || error) && <div className={`${styles.alert} ${error ? styles.error : ""}`}>{error || message}</div>}

    <section className={styles.actions}>
      <article><span>LIVE DEMAND</span><h2>Google Trends 수집</h2><p>한국 급상승 검색어를 가져와 쇼핑 적합도를 계산합니다.</p><button onClick={() => void run("/api/growth-commerce/trends", "trends", "GET")} disabled={busy === "trends"}>{busy === "trends" ? "수집 중…" : "급상승 수요 동기화"}</button></article>
      <article><span>YOUTUBE DATA</span><h2>성과·판매 통합 동기화</h2><p>조회수, 유지율, 참여, 추적 클릭, 전환, 매출을 영상별로 합칩니다.</p><button onClick={() => void run("/api/growth-commerce/youtube/sync", "youtube")} disabled={busy === "youtube"}>{busy === "youtube" ? "동기화 중…" : "YouTube 성과 동기화"}</button>{!status?.youtube?.connected && <a href="/admin/connections">YouTube 연결하기</a>}</article>
      <article><span>LEARNING LOOP</span><h2>다음 쇼츠 기준 재학습</h2><p>제목 패턴과 영상 길이를 판매 점수 기준으로 비교합니다.</p><button onClick={() => void run("/api/growth-commerce/learning", "learning")} disabled={busy === "learning"}>{busy === "learning" ? "학습 중…" : "판매 학습 실행"}</button></article>
    </section>

    <section className={styles.workspace}>
      <article className={styles.panel}><div className={styles.panelHead}><span>CAPCUT HANDOFF</span><h2>모바일 최종 편집 패키지</h2></div><p>V3-4 제작안의 영상 URL·SRT·대본·장면표·썸네일·게시 문구를 하나의 ZIP으로 만듭니다.</p><label>V3-4 제작안 ID<input value={variantId} onChange={(e: ChangeEvent<HTMLInputElement>) => setVariantId(e.target.value)} placeholder="shorts_production_variants_v34 ID"/></label><button onClick={() => void downloadCapcut()} disabled={busy === "capcut"}>{busy === "capcut" ? "만드는 중…" : "CapCut 패키지 받기"}</button><small>가짜 CapCut 프로젝트 파일을 만들지 않고 표준 MP4·SRT 중심으로 안전하게 전달합니다.</small></article>
      <article className={styles.panel}><div className={styles.panelHead}><span>CANVA CONNECT</span><h2>AI 썸네일 모바일 수정</h2></div><p>생성된 썸네일 이미지를 Canva 자산으로 올리고 1080×1920 편집 디자인을 엽니다.</p>{status?.canva?.connected ? <><label>썸네일 HTTPS 주소<input value={thumbnailUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setThumbnailUrl(e.target.value)} placeholder="https://.../thumbnail.png"/></label><label>Canva 디자인 제목<input value={thumbnailTitle} onChange={(e: ChangeEvent<HTMLInputElement>) => setThumbnailTitle(e.target.value)}/></label><button onClick={() => void createCanva()} disabled={busy === "canva"}>Canva에서 수정</button></> : <a className={styles.connect} href="/api/growth-commerce/canva/start">Canva 계정 연결</a>}<small>{status?.canva?.configured ? "Canva OAuth 환경변수 준비됨" : "CANVA_CLIENT_ID · CANVA_CLIENT_SECRET 설정 필요"}</small></article>
      <article className={styles.panel}><div className={styles.panelHead}><span>ATTRIBUTION</span><h2>상품 판매 추적 링크</h2></div><p>각 쇼츠의 제휴 클릭을 영상·콘텐츠별로 구분해 학습 데이터로 저장합니다.</p><label>GY-NEXUS 상품 ID<input value={productId} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductId(e.target.value)} placeholder="products.id"/></label><label>콘텐츠 키<input value={contentKey} onChange={(e: ChangeEvent<HTMLInputElement>) => setContentKey(e.target.value)} placeholder="washer-cleaner-hook-a"/></label><button onClick={() => void makeTrackingLink()} disabled={busy === "link"}>추적 링크 생성·복사</button>{trackingUrl && <code>{trackingUrl}</code>}</article>
    </section>

    <section className={styles.dataGrid}>
      <article><header><div><span>OPPORTUNITY FEED</span><h2>쇼핑 적합 급상승 키워드</h2></div><b>{status?.trends?.length || 0}</b></header><div className={styles.list}>{status?.trends?.length ? status.trends.map((row) => <div key={`${row.keyword}-${row.rank}`}><i>{row.rank}</i><strong>{row.keyword}</strong><small>수요 {number(row.traffic)} · 적합 {row.shopping_fit}</small></div>) : <p>‘급상승 수요 동기화’를 실행하세요.</p>}</div></article>
      <article><header><div><span>COMMERCE PERFORMANCE</span><h2>판매 기여 영상</h2></div><b>{topVideo?.commerce_score || 0}</b></header><div className={styles.list}>{status?.videos?.length ? status.videos.map((row) => <div key={row.video_id}><i>{row.commerce_score}</i><strong>{row.title}</strong><small>조회 {number(row.views)} · 유지 {number(row.average_view_percentage)}% · 클릭 {number(row.attributed_clicks)} · 구매 {number(row.conversions)}</small></div>) : <p>‘YouTube 성과 동기화’를 실행하세요.</p>}</div></article>
      <article><header><div><span>ACTIVE RULES</span><h2>다음 제작 학습 규칙</h2></div><b>{status?.rules?.filter((rule) => rule.active).length || 0}</b></header><div className={styles.list}>{status?.rules?.length ? status.rules.map((rule) => <div key={rule.rule_key}><i>{rule.direction === "prefer" ? "+" : "−"}</i><strong>{rule.segment}</strong><small>{rule.recommendation} · 표본 {rule.sample_size} · 신뢰 {rule.confidence}%</small></div>) : <p>성과 데이터가 쌓인 뒤 ‘판매 학습 실행’을 누르세요.</p>}</div></article>
    </section>
  </div>;
}
