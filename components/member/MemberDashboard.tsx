import Link from "next/link";

export default function MemberDashboard({ name, stats, interests }: { name: string; stats: { bookmarks: number; recentViews: number; notifications: number }; interests: string[] }) {
  return (
    <div className="member-grid">
      <section className="member-hero panel"><span className="eyebrow">GY MEMBER</span><h1>{name}님, 반갑습니다.</h1><p>GY가 관심 분야에 맞춰 콘텐츠와 상품을 추천합니다.</p><div className="actions"><Link href="/discover" className="button button-primary">추천 콘텐츠 보기</Link><Link href="/products" className="button button-light">추천 상품 보기</Link></div></section>
      <section className="grid grid-3 member-stat-links">
        <Link href="/member/bookmarks" className="panel stat-card"><p>북마크</p><strong>{stats.bookmarks}</strong><small>저장한 콘텐츠 · 열기 →</small></Link>
        <Link href="/discover" className="panel stat-card"><p>최근 본 콘텐츠</p><strong>{stats.recentViews}</strong><small>최근 30일 · 둘러보기 →</small></Link>
        <Link href="/member/notifications" className="panel stat-card"><p>알림</p><strong>{stats.notifications}</strong><small>새로운 소식 · 확인 →</small></Link>
      </section>
      <section className="panel"><h2>관심 분야</h2><div className="interest-chips">{interests.map((interest) => <span key={interest}>{interest}</span>)}</div><p className="help">관심 분야는 추천과 향후 개인화 알림에 사용됩니다. <Link href="/member/profile">관심 분야 수정 →</Link></p></section>
    </div>
  );
}
