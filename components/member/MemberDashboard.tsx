import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";

export default function MemberDashboard({ name, role, interests, bookmarks, comments, notifications, inquiries }: { name: string; role: string; interests: string[]; bookmarks: number; comments: number; notifications: number; inquiries: number }) {
  return (
    <div className="member-grid">
      <section className="member-hero panel">
        <div><span className="eyebrow">GY CUSTOMER PLATFORM</span><h1>{name}님, 반갑습니다.</h1><p>{role === "creator" ? "Creator 도구와 맞춤 콘텐츠를 한곳에서 관리하세요." : "관심 분야에 맞는 콘텐츠와 상품을 GY가 추천합니다."}</p></div>
        <div className="actions"><Link href="/discover" className="button button-primary">추천 콘텐츠</Link>{role === "creator" && <Link href="/admin/content-factory" className="button button-light">Creator Studio</Link>}<LogoutButton /></div>
      </section>
      <section className="grid grid-4 customer-stat-grid">
        <Link href="/member/bookmarks" className="panel stat-card"><p>북마크</p><strong>{bookmarks}</strong><small>저장한 콘텐츠</small></Link>
        <Link href="/member/comments" className="panel stat-card"><p>댓글</p><strong>{comments}</strong><small>내 활동</small></Link>
        <Link href="/member/notifications" className="panel stat-card"><p>알림</p><strong>{notifications}</strong><small>읽지 않은 소식</small></Link>
        <Link href="/member/inquiries" className="panel stat-card"><p>문의</p><strong>{inquiries}</strong><small>고객지원 내역</small></Link>
      </section>
      <section className="member-content-grid">
        <article className="panel"><div className="panel-heading"><div><span className="panel-kicker">개인화</span><h2>관심 분야</h2></div><Link href="/member/profile">수정 →</Link></div><div className="interest-chips">{interests.length ? interests.map((item) => <span key={item}>{item}</span>) : <span>관심 분야를 설정해 주세요.</span>}</div></article>
        <article className="panel"><div className="panel-heading"><div><span className="panel-kicker">계정</span><h2>GY Membership</h2></div></div><div className="membership-card"><span>{role === "creator" ? "CREATOR" : role === "admin" ? "OWNER" : "MEMBER"}</span><p>안전한 인증과 개인화된 GY 경험을 제공합니다.</p><Link href="/member/profile" className="text-link">프로필 관리 →</Link></div></article>
      </section>
    </div>
  );
}
