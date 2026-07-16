import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { hasOpenAIEnv, hasSupabaseEnv } from "@/lib/env";

const capabilities = [
  {
    label: "GY DNA",
    title: "링크 하나로 상품을 이해합니다.",
    description: "쿠팡·Temu·AliExpress·스마트스토어·일반 쇼핑몰 정보를 정리하고 캠페인 출발점으로 전환합니다.",
    href: "/admin/product-dna",
    icon: "◈",
  },
  {
    label: "GY Studio",
    title: "글·이미지·쇼츠를 한 흐름에서 만듭니다.",
    description: "승인용 글, SEO 글, 썸네일, 광고 이미지와 20·25·30초 쇼츠 프로젝트를 하나의 작업으로 관리합니다.",
    href: "/admin/content-factory",
    icon: "✦",
  },
  {
    label: "GY Quality",
    title: "게시 전에 품질을 먼저 확인합니다.",
    description: "가독성, SEO, 브랜드 일관성, 과장 표현과 게시 적합성을 검토해 결과물의 완성도를 높입니다.",
    href: "/admin/quality-center",
    icon: "✓",
  },
  {
    label: "GY Growth",
    title: "성과를 읽고 다음 행동을 제안합니다.",
    description: "Search Console과 GA4 데이터를 바탕으로 검색 성과, 인기 페이지와 개선 기회를 한 화면에서 확인합니다.",
    href: "/admin/growth",
    icon: "↗",
  },
];

const workflow = ["Import", "Product DNA", "Studio", "Quality", "Publish", "Growth"];

export default function Home() {
  const supabaseReady = hasSupabaseEnv();
  const openAiReady = hasOpenAIEnv();
  const readyCount = Number(supabaseReady) + Number(openAiReady);

  return (
    <div className="shell gy-home">
      <SiteHeader />
      <main>
        <section className="gy-hero">
          <div className="container gy-hero-grid">
            <div className="gy-hero-copy">
              <span className="gy-kicker">GY FIRST RELEASE PRODUCTION 1.0</span>
              <h1>
                더 적게 움직이고,
                <br />
                <em>더 높은 품질로 운영하세요.</em>
              </h1>
              <p>
                상품 발굴부터 콘텐츠 제작, 품질 검수, 게시와 성장 분석까지. 흩어진 작업을 하나의 GY 운영 흐름으로 연결합니다.
              </p>
              <div className="gy-hero-actions">
                <Link href="/admin" className="gy-button gy-button-primary">
                  GY 시작하기 <span aria-hidden="true">→</span>
                </Link>
                <Link href="/discover" className="gy-button gy-button-secondary">
                  콘텐츠 둘러보기
                </Link>
              </div>
              <div className="gy-proof-row" aria-label="GY 핵심 운영 기준">
                <span>품질 검수</span>
                <span>모바일 대응</span>
                <span>회원·비회원 운영</span>
                <span>멀티채널 확장</span>
              </div>
            </div>

            <div className="gy-live-board" aria-label="GY 운영 보드 미리보기">
              <div className="gy-live-top">
                <div>
                  <small>GY SYSTEM</small>
                  <strong>운영 준비 상태</strong>
                </div>
                <span className="gy-live-pill"><i /> LIVE</span>
              </div>

              <div className="gy-brand-core">
                <span>GY</span>
                <div className="gy-core-ring ring-one" />
                <div className="gy-core-ring ring-two" />
                <div className="gy-core-ring ring-three" />
              </div>

              <div className="gy-status-grid">
                <article>
                  <span>핵심 연결</span>
                  <strong>{readyCount}/2</strong>
                  <small>OpenAI · Supabase</small>
                </article>
                <article>
                  <span>콘텐츠 기준</span>
                  <strong>90+</strong>
                  <small>품질 점수 목표</small>
                </article>
                <article>
                  <span>영상 길이</span>
                  <strong>20–30s</strong>
                  <small>직접 선택 가능</small>
                </article>
                <article>
                  <span>운영 화면</span>
                  <strong>1</strong>
                  <small>통합 Command Center</small>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="container gy-section gy-capabilities">
          <div className="gy-section-heading">
            <div>
              <span className="gy-kicker gy-kicker-light">WHAT GY DOES</span>
              <h2>기능을 나열하지 않고, 운영 흐름을 완성합니다.</h2>
            </div>
            <p>각 모듈은 따로 존재하지 않습니다. 하나의 캠페인이 다음 단계로 자연스럽게 이어지도록 설계됩니다.</p>
          </div>

          <div className="gy-capability-grid">
            {capabilities.map((item) => (
              <Link href={item.href} className="gy-capability-card" key={item.label}>
                <span className="gy-capability-icon">{item.icon}</span>
                <small>{item.label}</small>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className="gy-card-link">열기 →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="gy-flow-section">
          <div className="container">
            <div className="gy-flow-panel">
              <div className="gy-flow-copy">
                <span className="gy-kicker gy-kicker-light">GY OPERATING FLOW</span>
                <h2>하나의 입력이 하나의 성장 흐름으로 이어집니다.</h2>
                <p>상품 링크, 이미지 또는 상품명에서 시작해 제작·검수·게시·분석까지 같은 프로젝트 안에서 관리합니다.</p>
              </div>
              <div className="gy-flow-track">
                {workflow.map((item, index) => (
                  <div className="gy-flow-step" key={item}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item}</strong>
                    {index < workflow.length - 1 && <i aria-hidden="true">→</i>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="container gy-section gy-system-section">
          <div className="gy-system-card">
            <div>
              <span className="gy-kicker gy-kicker-light">SYSTEM READINESS</span>
              <h2>외부 계정을 연결하면 운영 준비가 이어집니다.</h2>
              <p>현재 로컬 환경의 핵심 연결 상태를 확인하고, 준비되지 않은 항목은 설정 화면에서 바로 이어갈 수 있습니다.</p>
            </div>
            <div className="gy-system-statuses">
              <span className={supabaseReady ? "is-ready" : "needs-setup"}>
                <i /> Supabase {supabaseReady ? "연결됨" : "설정 필요"}
              </span>
              <span className={openAiReady ? "is-ready" : "needs-setup"}>
                <i /> OpenAI {openAiReady ? "연결됨" : "설정 필요"}
              </span>
              <Link href="/admin/connections" className="gy-inline-link">연결센터 열기 →</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="gy-footer">
        <div className="container gy-footer-inner">
          <div className="gy-footer-brand">
            <span className="brand-mark">GY</span>
            <div><strong>GY</strong><small>First Release Production 1.0</small></div>
          </div>
          <nav aria-label="하단 메뉴">
            <Link href="/discover">콘텐츠</Link>
            <Link href="/products">상품</Link>
            <Link href="/login">로그인</Link>
            <Link href="/admin">Command Center</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
