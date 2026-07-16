import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { hasOpenAIEnv, hasSupabaseEnv } from "@/lib/env";

const capabilities = [
  { kicker: "DISCOVER", title: "GY Product DNA", text: "상품 링크와 핵심 정보를 분석해 브랜드에 맞는 판매 포인트와 캠페인 구조를 설계합니다." },
  { kicker: "CREATE", title: "GY Studio", text: "블로그, 쇼츠, 이미지, 썸네일과 20·25·30초 영상 흐름을 하나의 제작 경험으로 연결합니다." },
  { kicker: "VERIFY", title: "GY Quality", text: "사실성, SEO, 가독성, 브랜드 일관성, 과장 표현을 검수해 게시 가능한 수준으로 끌어올립니다." },
  { kicker: "GROW", title: "GY Growth", text: "게시 이후 유입과 성과를 읽고 다음 콘텐츠와 상품 기회를 더 정교하게 제안합니다." },
];

const flow = ["Import", "Product DNA", "GY Studio", "Quality", "Publish", "Growth"];

export default function Home() {
  const supabaseReady = hasSupabaseEnv();
  const openAiReady = hasOpenAIEnv();

  return (
    <div className="gy-shell">
      <SiteHeader />
      <main>
        <section className="gy-hero">
          <div className="gy-aurora gy-aurora-a" />
          <div className="gy-aurora gy-aurora-b" />
          <div className="container gy-hero-grid">
            <div className="gy-hero-copy">
              <span className="gy-pill">GY FIRST RELEASE PRODUCTION 1.0</span>
              <h1>
                <span>GY</span>
                <br />
                Create better.
                <br />
                <em>Grow with clarity.</em>
              </h1>
              <p>
                상품 발굴부터 콘텐츠 제작, 품질 검수, 게시와 성장 분석까지.
                흩어진 작업을 하나의 정교한 GY 경험으로 연결합니다.
              </p>
              <div className="gy-actions">
                <Link href="/admin" className="gy-button gy-button-primary">GY 시작하기</Link>
                <Link href="/discover" className="gy-button gy-button-ghost">브랜드 경험 보기</Link>
              </div>
              <div className="gy-proof-row">
                <span>Quality-first</span>
                <span>Mobile-ready</span>
                <span>Brand-consistent</span>
              </div>
            </div>

            <div className="gy-intelligence-card" aria-label="GY Intelligence status">
              <div className="gy-card-topline">
                <span>GY INTELLIGENCE</span>
                <span className="gy-live"><i /> LIVE</span>
              </div>
              <div className="gy-core-wrap">
                <div className="gy-core-ring gy-ring-one" />
                <div className="gy-core-ring gy-ring-two" />
                <div className="gy-core">GY</div>
                <div className="gy-float gy-float-a">Product DNA</div>
                <div className="gy-float gy-float-b">Studio</div>
                <div className="gy-float gy-float-c">Quality</div>
                <div className="gy-float gy-float-d">Growth</div>
              </div>
              <div className="gy-metrics">
                <div><small>Brand score</small><strong>96</strong></div>
                <div><small>Quality gate</small><strong>Ready</strong></div>
                <div><small>System status</small><strong>Stable</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className="gy-section container">
          <div className="gy-section-heading">
            <span className="gy-kicker">GY PLATFORM</span>
            <h2>기능이 아니라, 하나의 완성된 흐름.</h2>
            <p>고객이 이해하기 쉽고, 운영자는 빠르게 판단할 수 있도록 모든 단계를 하나의 경험으로 설계합니다.</p>
          </div>
          <div className="gy-capability-grid">
            {capabilities.map((item) => (
              <article key={item.title} className="gy-capability-card">
                <span>{item.kicker}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <b>Explore →</b>
              </article>
            ))}
          </div>
        </section>

        <section className="gy-flow-section">
          <div className="container">
            <div className="gy-flow-head">
              <div>
                <span className="gy-kicker">OPERATING FLOW</span>
                <h2>GY가 연결하는 전체 과정</h2>
              </div>
              <p>단절된 도구가 아니라, 처음부터 결과까지 이어지는 운영 흐름입니다.</p>
            </div>
            <div className="gy-flow-grid">
              {flow.map((item, index) => (
                <div className="gy-flow-step" key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container gy-status-card">
          <div>
            <span className="gy-kicker">SYSTEM STATUS</span>
            <h2>배포를 위한 핵심 연결 상태</h2>
            <p>외부 계정 연결 후 Vercel에 배포하면 PC와 모바일에서 24시간 운영할 수 있습니다.</p>
          </div>
          <div className="gy-status-list">
            <span className={supabaseReady ? "ready" : "pending"}>Supabase · {supabaseReady ? "Ready" : "Setup required"}</span>
            <span className={openAiReady ? "ready" : "pending"}>OpenAI · {openAiReady ? "Ready" : "Setup required"}</span>
          </div>
        </section>
      </main>

      <footer className="gy-footer">
        <div className="container">
          <strong>GY</strong>
          <span>Create better. Grow with clarity.</span>
        </div>
      </footer>
    </div>
  );
}
