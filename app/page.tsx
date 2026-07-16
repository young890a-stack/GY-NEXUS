import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { hasOpenAIEnv, hasSupabaseEnv } from "@/lib/env";

export default function Home() {
  const supabaseReady = hasSupabaseEnv();
  const openAiReady = hasOpenAIEnv();
  return <div className="shell production-home"><SiteHeader /><main>
    <section className="production-hero"><div className="container production-hero-grid"><div><span className="production-badge">GY FIRST RELEASE PRODUCTION 1.0</span><h1>대표 한 명과 AI가<br/><em>함께 운영하는 회사.</em></h1><p>상품 발굴부터 콘텐츠, 이미지, 20·25·30초 쇼츠, SEO, 게시, 고객 관리, 성장 분석까지 하나의 GY Company OS에서 운영합니다.</p><div className="actions"><Link href="/admin" className="button button-primary">GY Company OS 시작</Link><Link href="/discover" className="button button-light">고객 사이트 보기</Link></div><div className="production-trust"><span>✓ 품질 90점 기준</span><span>✓ 모바일 운영</span><span>✓ 회원·비회원 관리</span></div></div><div className="company-orbit panel"><div className="orbit-logo">GY</div><div className="orbit-item one">Product DNA</div><div className="orbit-item two">Quality Engine</div><div className="orbit-item three">Creative Studio</div><div className="orbit-item four">Customer CRM</div><div className="system-live"><i /> Dream Y Core 가동 중</div></div></div></section>
    <section className="container section"><div className="section-head"><div><span className="eyebrow">ONE HUMAN. ONE AI COMPANY.</span><h2>GY의 첫 번째 공식 운영 구조</h2></div></div><div className="grid grid-4 production-features"><article className="panel"><span>🧬</span><h3>상품 가치화</h3><p>제휴링크·이미지·상품명에서 Product DNA를 만들고 새로운 광고 콘셉트로 재창작합니다.</p></article><article className="panel"><span>🎬</span><h3>콘텐츠 공장</h3><p>블로그, 이미지, 썸네일과 20·25·30초 멀티샷 쇼츠를 제작합니다.</p></article><article className="panel"><span>🛡️</span><h3>품질 엔진</h3><p>사실성, SEO, 가독성, 브랜드, 과장 표현을 검수하고 게시 가능 여부를 판단합니다.</p></article><article className="panel"><span>👥</span><h3>고객 플랫폼</h3><p>방문자와 회원을 구분하고 관심 분야, 북마크, 문의, 추천 기반을 관리합니다.</p></article></div></section>
    <section className="container production-ready panel"><div><span className="eyebrow">SYSTEM STATUS</span><h2>실운영 전 연결 상태</h2><p>외부 계정 연결 후 Vercel에 배포하면 PC와 휴대폰에서 24시간 사용할 수 있습니다.</p></div><div className="ready-status"><span className={supabaseReady?"on":"off"}>Supabase {supabaseReady?"준비":"설정 필요"}</span><span className={openAiReady?"on":"off"}>OpenAI {openAiReady?"준비":"설정 필요"}</span></div></section>
  </main></div>;
}
