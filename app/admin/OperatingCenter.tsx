"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdminLocale } from "@/components/admin/AdminLocale";

type Service = { name: string; ready: boolean; detail: string };
type PopularItem = { id: string; title: string; clicks: number };

type Props = {
  productCount: number;
  clickCount: number;
  contentCount: number;
  connectedCount: number;
  totalServices: number;
  services: Service[];
  popular: PopularItem[];
  loadError?: string;
  supabaseReady: boolean;
};

const jobs = [
  { name: "상품 기회 분석", value: 92, status: "분석 중", tone: "cyan" },
  { name: "블로그 콘텐츠", value: 74, status: "작성 중", tone: "violet" },
  { name: "쇼츠 패키지", value: 100, status: "완료", tone: "green" },
  { name: "썸네일 렌더링", value: 58, status: "생성 중", tone: "blue" },
  { name: "채널 발행", value: 31, status: "대기", tone: "amber" },
];

const pipeline = [
  ["Discover", "상품 수집", "done"],
  ["Analyze", "AI 분석", "done"],
  ["Product DNA", "판매 포인트", "done"],
  ["Create", "콘텐츠 생성", "active"],
  ["Quality", "품질 검수", "waiting"],
  ["Publish", "예약 발행", "waiting"],
  ["Learn", "성과 학습", "waiting"],
] as const;

const feed = [
  ["상품 분석 완료", "Galaxy Tab S10 FE의 핵심 구매 포인트 7개를 추출했습니다."],
  ["쇼츠 패키지 생성", "25초 대본과 검수된 한국어 자막을 준비했습니다."],
  ["SEO 품질 확인", "검색 의도·제목·본문 구조 검사를 통과했습니다."],
  ["썸네일 렌더링", "20~40대 타깃용 크리에이티브를 생성하고 있습니다."],
  ["게시 대기열 업데이트", "다음 최적 발행 시간에 콘텐츠 3건을 배치했습니다."],
] as const;

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown.toLocaleString("ko-KR")}{suffix}</>;
}

export default function OperatingCenter(props: Props) {
  const { locale } = useAdminLocale();
  const isKo = locale === "ko";
  const [feedIndex, setFeedIndex] = useState(0);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const update = () => setClock(new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [locale]);

  useEffect(() => {
    const timer = window.setInterval(() => setFeedIndex((current) => (current + 1) % feed.length), 4200);
    return () => window.clearInterval(timer);
  }, []);

  const systemHealth = useMemo(() => {
    if (!props.totalServices) return 0;
    return Math.round((props.connectedCount / props.totalServices) * 100);
  }, [props.connectedCount, props.totalServices]);

  return (
    <div className="ops-shell">
      <section className="ops-hero">
        <div className="ops-hero-copy">
          <div className="ops-live-line"><i /> GY AI OPERATING CENTER <span>{clock}</span></div>
          <h1>{isKo ? <>회사의 모든 AI 작업을<br /><em>한 화면에서 지휘합니다.</em></> : <>Direct every AI operation<br /><em>from one command center.</em></>}</h1>
          <p>{isKo ? "Dream Y Core가 상품 탐색부터 콘텐츠 생성, 품질 검수, 발행과 성과 학습까지 하나의 운영 흐름으로 관리합니다." : "Dream Y Core orchestrates product discovery, content creation, quality control, publishing, and performance learning in one operating flow."}</p>
          <div className="ops-hero-actions">
            <Link href="/admin/strategy-room" className="button button-primary">{isKo ? "AI 전략회의 시작" : "Start AI Strategy"}</Link>
            <Link href="/admin/automation" className="button button-dark">{isKo ? "자동화 대기열 보기" : "View Automation Queue"}</Link>
          </div>
        </div>
        <div className="ops-core-card">
          <div className="ops-core-orbit"><span /><span /><span /><b>GY</b></div>
          <div>
            <small>DREAM Y CORE</small>
            <strong>ONLINE</strong>
            <p>{isKo ? "현재 5개의 운영 워크플로를 조율 중입니다." : "Orchestrating 5 operating workflows."}</p>
          </div>
          <div className="ops-health"><span>{isKo ? "시스템 상태" : "System health"}</span><b>{systemHealth}%</b><i><em style={{ width: `${systemHealth}%` }} /></i></div>
        </div>
      </section>

      {!props.supabaseReady && <div className="alert alert-warning dashboard-alert">{isKo ? "Supabase 환경변수가 없어 일부 지표는 0으로 표시됩니다." : "Supabase environment variables are missing, so some metrics are shown as zero."} <Link href="/admin/settings"><b>{isKo ? "설정 안내" : "Settings"}</b></Link></div>}
      {props.loadError && <div className="alert alert-error dashboard-alert">{props.loadError}</div>}

      <section className="ops-kpis">
        <article><span>{isKo ? "등록 상품" : "Products"}</span><strong><AnimatedNumber value={props.productCount} suffix={isKo ? "개" : ""} /></strong><small>Product inventory</small></article>
        <article><span>{isKo ? "누적 클릭" : "Total clicks"}</span><strong><AnimatedNumber value={props.clickCount} suffix={isKo ? "회" : ""} /></strong><small>Affiliate traffic</small></article>
        <article><span>{isKo ? "생성 콘텐츠" : "AI content"}</span><strong><AnimatedNumber value={props.contentCount} suffix={isKo ? "개" : ""} /></strong><small>AI production</small></article>
        <article><span>{isKo ? "연결 서비스" : "Connections"}</span><strong><AnimatedNumber value={props.connectedCount} />/{props.totalServices}</strong><small>External systems</small></article>
        <article><span>{isKo ? "오늘의 AI 작업" : "AI jobs today"}</span><strong><AnimatedNumber value={23} suffix={isKo ? "건" : ""} /></strong><small>6 jobs active</small></article>
      </section>

      <section className="ops-main-grid">
        <article className="ops-panel ops-jobs-panel">
          <div className="ops-panel-head"><div><small>LIVE PRODUCTION</small><h2>{isKo ? "AI 작업 대기열" : "AI work queue"}</h2></div><span className="ops-pulse-label"><i /> {isKo ? "실시간 실행" : "Live execution"}</span></div>
          <div className="ops-jobs">
            {jobs.map((job) => <div className="ops-job" key={job.name}>
              <div><strong>{job.name}</strong><span>{job.status}</span></div>
              <div className="ops-job-track"><i className={`tone-${job.tone}`} style={{ width: `${job.value}%` }} /></div>
              <b>{job.value}%</b>
            </div>)}
          </div>
        </article>

        <article className="ops-panel ops-feed-panel">
          <div className="ops-panel-head"><div><small>ACTIVITY FEED</small><h2>{isKo ? "실시간 운영 로그" : "Live activity"}</h2></div><Link href="/admin/company-os">{isKo ? "전체 보기 →" : "View all →"}</Link></div>
          <div className="ops-feed-feature" key={feedIndex}><span>NOW</span><strong>{feed[feedIndex][0]}</strong><p>{feed[feedIndex][1]}</p></div>
          <div className="ops-feed-list">
            {feed.slice(0, 4).map((item, index) => <div key={item[0]}><i className={index === 0 ? "active" : ""} /><time>{String(9 + index).padStart(2, "0")}:{18 + index * 3}</time><span><b>{item[0]}</b><small>{item[1]}</small></span></div>)}
          </div>
        </article>
      </section>

      <section className="ops-panel ops-pipeline-panel">
        <div className="ops-panel-head"><div><small>END-TO-END SYSTEM</small><h2>{isKo ? "GY AI 운영 파이프라인" : "GY AI operating pipeline"}</h2></div><Link href="/admin/ai-factory">{isKo ? "AI Factory 열기 →" : "Open AI Factory →"}</Link></div>
        <div className="ops-pipeline">
          {pipeline.map(([title, subtitle, status], index) => <div className={`ops-stage ${status}`} key={title}>
            <span>{status === "done" ? "✓" : String(index + 1).padStart(2, "0")}</span><strong>{title}</strong><small>{subtitle}</small>{index < pipeline.length - 1 && <i />}
          </div>)}
        </div>
      </section>

      <section className="ops-bottom-grid">
        <article className="ops-panel">
          <div className="ops-panel-head"><div><small>CONNECTION CENTER</small><h2>{isKo ? "외부 시스템 상태" : "External systems"}</h2></div><Link href="/admin/connections">{isKo ? "연결 관리 →" : "Manage connections →"}</Link></div>
          <div className="ops-services">
            {props.services.map((service) => <div key={service.name}><span className={service.ready ? "connected" : "offline"}><i /></span><b>{service.name}</b><small>{service.detail}</small><em>{service.ready ? (isKo ? "연결됨" : "Connected") : (isKo ? "설정 필요" : "Setup required")}</em></div>)}
          </div>
        </article>

        <article className="ops-panel">
          <div className="ops-panel-head"><div><small>PERFORMANCE SIGNAL</small><h2>{isKo ? "인기 상품 TOP 5" : "Top 5 products"}</h2></div><Link href="/admin/analytics">{isKo ? "분석 보기 →" : "View analytics →"}</Link></div>
          {props.popular.length ? <div className="ops-ranking">{props.popular.map((item, index) => <div key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><b>{item.title}</b><em>{item.clicks} clicks</em></div>)}</div> : <div className="ops-empty">{isKo ? "상품과 클릭 데이터가 쌓이면 AI가 성과 순위를 표시합니다." : "AI performance rankings will appear as product and click data accumulates."}</div>}
          <div className="ops-quick-actions">
            <Link href="/admin/content">{isKo ? "AI 콘텐츠 생성" : "Create AI content"}</Link><Link href="/admin/import">{isKo ? "상품 자동 등록" : "Import products"}</Link><Link href="/admin/publishing">{isKo ? "예약 게시" : "Schedule publishing"}</Link>
          </div>
        </article>
      </section>

      <button className={`ops-copilot-button ${copilotOpen ? "open" : ""}`} onClick={() => setCopilotOpen(!copilotOpen)} aria-label={isKo ? "Dream Y Copilot 열기" : "Open Dream Y Copilot"}><span>GY</span><i /></button>
      {copilotOpen && <aside className="ops-copilot">
        <div><span>GY COPILOT</span><button onClick={() => setCopilotOpen(false)}>×</button></div>
        <strong>{isKo ? "대표님, 오늘의 운영 제안입니다." : "Here is today’s operating recommendation."}</strong>
        <p>{isKo ? "현재 쇼츠 패키지 1건이 완료됐습니다. 썸네일 검수가 끝나면 YouTube 예약 대기열로 이동할 수 있습니다." : "One Shorts package is complete. After thumbnail review, it can move to the YouTube scheduling queue."}</p>
        <Link href="/admin/publishing">{isKo ? "발행 대기열 확인 →" : "Review publishing queue →"}</Link>
      </aside>}
    </div>
  );
}
