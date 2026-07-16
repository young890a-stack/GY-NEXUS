import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const admin = createAdminClient();
  const [{ data: profiles, count: total }, { count: inquiryCount }, { count: openInquiries }] = await Promise.all([
    admin.from("profiles").select("id,display_name,role,status,interests,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
    admin.from("customer_inquiries").select("id", { count: "exact", head: true }),
    admin.from("customer_inquiries").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
  ]);

  const userIds = (profiles || []).map((profile) => profile.id);
  const users = userIds.length ? await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }) : null;
  const emailMap = new Map((users?.data.users || []).map((user) => [user.id, user.email || ""]));
  const memberCount = (profiles || []).filter((item) => item.role === "member").length;
  const creatorCount = (profiles || []).filter((item) => item.role === "creator").length;

  return (
    <div className="admin-page-stack">
      <section className="dashboard-hero compact-dashboard-hero"><div><span className="dashboard-kicker">GY CUSTOMER PLATFORM</span><h1>Customer Center</h1><p>회원·Creator·문의 현황을 한 화면에서 관리합니다.</p></div></section>
      <section className="dashboard-stats">
        <article className="metric-card"><span>◎</span><div><p>전체 고객</p><strong>{total || 0}명</strong></div></article>
        <article className="metric-card"><span>◇</span><div><p>일반 회원</p><strong>{memberCount}명</strong></div></article>
        <article className="metric-card"><span>✦</span><div><p>Creator</p><strong>{creatorCount}명</strong></div></article>
        <article className="metric-card"><span>!</span><div><p>처리할 문의</p><strong>{openInquiries || 0}/{inquiryCount || 0}</strong></div></article>
      </section>
      <section className="dashboard-panel">
        <div className="panel-heading"><div><span className="panel-kicker">CRM</span><h2>고객 목록</h2></div><span>{profiles?.length || 0}명 표시</span></div>
        <div className="customer-table-wrap"><table className="customer-table"><thead><tr><th>고객</th><th>역할</th><th>관심 분야</th><th>상태</th><th>가입일</th></tr></thead><tbody>{profiles?.length ? profiles.map((profile) => <tr key={profile.id}><td><b>{profile.display_name || "이름 미설정"}</b><small>{emailMap.get(profile.id) || profile.id}</small></td><td><span className="status-pill">{profile.role}</span></td><td>{Array.isArray(profile.interests) ? profile.interests.join(", ") : "-"}</td><td>{profile.status}</td><td>{new Date(profile.created_at).toLocaleDateString("ko-KR")}</td></tr>) : <tr><td colSpan={5}><div className="empty">등록된 고객이 없습니다.</div></td></tr>}</tbody></table></div>
      </section>
    </div>
  );
}
