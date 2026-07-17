"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import SiteHeader from "@/components/SiteHeader";

const capabilities = [
  { number: "01", kicker: "DISCOVER", title: "GY Product DNA", text: "상품 링크와 핵심 정보를 분석해 판매 포인트, 타깃, 메시지와 캠페인 구조를 설계합니다." },
  { number: "02", kicker: "CREATE", title: "GY AI Factory", text: "블로그, 쇼츠, 이미지, 썸네일과 20·25·30초 영상 흐름을 하나의 제작 경험으로 연결합니다." },
  { number: "03", kicker: "VERIFY", title: "GY Quality", text: "사실성, SEO, 가독성, 브랜드 일관성과 과장 표현을 검수해 게시 가능한 수준으로 끌어올립니다." },
  { number: "04", kicker: "GROW", title: "GY Growth", text: "게시 이후 유입과 성과를 읽고 다음 콘텐츠와 상품 기회를 더 정교하게 제안합니다." },
];

const flow = ["Import", "Product DNA", "AI Factory", "Quality", "Publish", "Growth"];

type Props = {
  supabaseReady: boolean;
  openAiReady: boolean;
};

export default function GyMotionLanding({ supabaseReady, openAiReady }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const header = document.querySelector<HTMLElement>(".gy-site-header");

    const onPointerMove = (event: PointerEvent) => {
      const x = event.clientX / window.innerWidth;
      const y = event.clientY / window.innerHeight;
      shell.style.setProperty("--pointer-x", `${event.clientX}px`);
      shell.style.setProperty("--pointer-y", `${event.clientY}px`);
      shell.style.setProperty("--hero-shift-x", `${(x - 0.5) * 34}px`);
      shell.style.setProperty("--hero-shift-y", `${(y - 0.5) * 26}px`);
    };

    const onScroll = () => {
      header?.classList.toggle("gy-header-scrolled", window.scrollY > 22);
    };

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    shell.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
      revealObserver.observe(element);
    });

    const tiltElements = Array.from(shell.querySelectorAll<HTMLElement>("[data-tilt]"));
    const cleanups: Array<() => void> = [];

    if (!reducedMotion) {
      tiltElements.forEach((element) => {
        const onMove = (event: PointerEvent) => {
          const rect = element.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width;
          const y = (event.clientY - rect.top) / rect.height;
          const rotateY = (x - 0.5) * 8;
          const rotateX = (0.5 - y) * 7;
          element.style.setProperty("--tilt-x", `${rotateX}deg`);
          element.style.setProperty("--tilt-y", `${rotateY}deg`);
          element.style.setProperty("--shine-x", `${x * 100}%`);
          element.style.setProperty("--shine-y", `${y * 100}%`);
        };
        const onLeave = () => {
          element.style.setProperty("--tilt-x", "0deg");
          element.style.setProperty("--tilt-y", "0deg");
        };
        element.addEventListener("pointermove", onMove);
        element.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          element.removeEventListener("pointermove", onMove);
          element.removeEventListener("pointerleave", onLeave);
        });
      });
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      revealObserver.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div ref={shellRef} className="gy-shell gy-motion-shell">
      <div className="gy-cursor-glow" aria-hidden="true" />
      <SiteHeader />
      <main>
        <section className="gy-hero gy-motion-hero">
          <div className="gy-aurora gy-aurora-a" />
          <div className="gy-aurora gy-aurora-b" />
          <div className="gy-aurora gy-aurora-c" />
          <div className="gy-noise" />
          <div className="gy-hero-mesh" aria-hidden="true" />
          <div className="container gy-hero-grid">
            <div className="gy-hero-copy gy-hero-entry">
              <span className="gy-pill"><i /> GY FIRST RELEASE · PRODUCTION 1.0</span>
              <h1>
                <span>Build with GY.</span>
                <br />
                Create with precision.
                <br />
                <em>Grow with clarity.</em>
              </h1>
              <p>
                상품 발굴, 콘텐츠 제작, 품질 검수, 게시와 성장 분석까지.
                흩어진 업무를 하나의 고급스러운 운영 경험으로 연결합니다.
              </p>
              <div className="gy-actions">
                <Link href="/admin" className="gy-button gy-button-primary gy-magnetic">GY 열기 <b>↗</b></Link>
                <Link href="/admin/ai-factory" className="gy-button gy-button-ghost gy-magnetic">AI Factory 보기</Link>
              </div>
              <div className="gy-proof-row">
                <span>Production-ready</span>
                <span>Mobile-first</span>
                <span>Quality-gated</span>
              </div>
            </div>

            <div className="gy-intelligence-card gy-hero-card-entry" data-tilt aria-label="GY Intelligence status">
              <div className="gy-card-shine" aria-hidden="true" />
              <div className="gy-card-topline">
                <span>GY INTELLIGENCE</span>
                <span className="gy-live"><i /> LIVE</span>
              </div>
              <div className="gy-core-wrap">
                <div className="gy-core-halo" />
                <div className="gy-core-ring gy-ring-one" />
                <div className="gy-core-ring gy-ring-two" />
                <div className="gy-core">GY</div>
                <div className="gy-float gy-float-a">Product DNA</div>
                <div className="gy-float gy-float-b">AI Factory</div>
                <div className="gy-float gy-float-c">Quality</div>
                <div className="gy-float gy-float-d">Growth</div>
              </div>
              <div className="gy-metrics">
                <div><small>Brand score</small><strong className="gy-count">96</strong></div>
                <div><small>Quality gate</small><strong>Ready</strong></div>
                <div><small>System</small><strong>Stable</strong></div>
              </div>
            </div>
          </div>
          <div className="gy-scroll-cue"><span /> Explore GY</div>
        </section>

        <section className="gy-trust-strip" data-reveal>
          <div className="container">
            <span>PRODUCT DNA</span><i />
            <span>AI FACTORY</span><i />
            <span>QUALITY ENGINE</span><i />
            <span>PUBLISHING</span><i />
            <span>GROWTH INTELLIGENCE</span>
          </div>
        </section>

        <section className="gy-section container">
          <div className="gy-section-heading" data-reveal>
            <span className="gy-kicker">GY PLATFORM</span>
            <h2>도구의 집합이 아니라,<br />하나의 완성된 흐름.</h2>
            <p>고객에게는 단순하고 인상적인 경험을, 운영에는 빠른 판단과 높은 품질을 제공합니다.</p>
          </div>
          <div className="gy-capability-grid">
            {capabilities.map((item, index) => (
              <article
                key={item.title}
                className="gy-capability-card gy-motion-card"
                data-reveal
                data-tilt
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <div className="gy-card-shine" aria-hidden="true" />
                <div className="gy-card-number">{item.number}</div>
                <span>{item.kicker}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Link href="/admin" aria-label={`${item.title} 열기`}>Explore <b>↗</b></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="gy-showcase-section">
          <div className="container gy-showcase-grid">
            <div data-reveal>
              <span className="gy-kicker">AI FACTORY</span>
              <h2>한 번의 입력으로<br />브랜드 콘텐츠를 완성합니다.</h2>
              <p>제휴 링크나 상품 정보에서 Product DNA를 만들고, 블로그·쇼츠·이미지·영상까지 일관된 톤으로 확장합니다.</p>
              <Link href="/admin/ai-factory" className="gy-text-link">Open GY AI Factory <b>↗</b></Link>
            </div>
            <div className="gy-showcase-window gy-motion-window" data-reveal data-tilt>
              <div className="gy-card-shine" aria-hidden="true" />
              <div className="gy-window-top"><span /><span /><span /><b>GY / AI FACTORY</b></div>
              <div className="gy-window-body">
                <div className="gy-window-sidebar"><i /><i /><i /><i /></div>
                <div className="gy-window-content">
                  <span>CAMPAIGN READY</span>
                  <h3>Product DNA → Premium Shorts</h3>
                  <div className="gy-progress"><b /></div>
                  <div className="gy-window-cards"><i /><i /><i /></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="gy-flow-section">
          <div className="container">
            <div className="gy-flow-head" data-reveal>
              <div>
                <span className="gy-kicker">OPERATING FLOW</span>
                <h2>처음부터 결과까지,<br />GY가 연결합니다.</h2>
              </div>
              <p>단절된 도구가 아니라, 발견·제작·검수·게시·성장으로 이어지는 하나의 운영 시스템입니다.</p>
            </div>
            <div className="gy-flow-grid">
              {flow.map((item, index) => (
                <div className="gy-flow-step gy-motion-card" data-reveal data-tilt key={item} style={{ transitionDelay: `${index * 65}ms` }}>
                  <div className="gy-card-shine" aria-hidden="true" />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container gy-status-card gy-motion-card" data-reveal data-tilt>
          <div className="gy-card-shine" aria-hidden="true" />
          <div>
            <span className="gy-kicker">SYSTEM STATUS</span>
            <h2>배포를 위한 핵심 연결 상태</h2>
            <p>외부 계정을 연결하고 Vercel에 배포하면 PC와 모바일에서 24시간 운영할 수 있습니다.</p>
          </div>
          <div className="gy-status-list">
            <span className={supabaseReady ? "ready" : "pending"}>Supabase <b>{supabaseReady ? "Ready" : "Setup required"}</b></span>
            <span className={openAiReady ? "ready" : "pending"}>OpenAI <b>{openAiReady ? "Ready" : "Setup required"}</b></span>
          </div>
        </section>
      </main>

      <footer className="gy-footer gy-motion-footer">
        <div className="gy-footer-glow" aria-hidden="true" />
        <div className="container">
          <div><strong>GY</strong><span>AI Content & Commerce Platform</span></div>
          <span>Create with precision. Grow with clarity.</span>
        </div>
      </footer>
    </div>
  );
}
