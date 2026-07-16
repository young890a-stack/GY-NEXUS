import Link from "next/link";

export default function MemberDashboard({ name }: { name: string }) {
  return (
    <div className="member-grid">
      <section className="member-hero panel"><span className="eyebrow">GY MEMBER</span><h1>{name}님, 반갑습니다.</h1><p>GY가 관심 분야에 맞춰 콘텐츠와 상품을 추천합니다.</p><div className="actions"><Link href="/discover" className="button button-primary">추천 콘텐츠 보기</Link><Link href="/products" className="button button-light">추천 상품 보기</Link></div></section>
      <section className="grid grid-3">
        <article className="panel stat-card"><p>북마크</p><strong>0</strong><small>저장한 콘텐츠</small></article>
        <article className="panel stat-card"><p>최근 본 콘텐츠</p><strong>0</strong><small>최근 30일</small></article>
        <article className="panel stat-card"><p>알림</p><strong>0</strong><small>새로운 소식</small></article>
      </section>
      <section className="panel"><h2>관심 분야</h2><div className="interest-chips"><span>AI</span><span>재테크</span><span>부업</span><span>IT</span><span>쇼핑</span></div><p className="help">Production 1.0에서는 관심 분야별 추천 기반을 제공합니다.</p></section>
    </div>
  );
}
