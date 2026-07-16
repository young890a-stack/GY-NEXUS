import SiteHeader from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/member/notifications");
  const { data } = await supabase.from("customer_notifications").select("id,title,body,type,is_read,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  return <div className="shell"><SiteHeader /><main className="container section"><section className="member-page-heading"><span className="eyebrow">GY NOTIFICATIONS</span><h1>알림센터</h1><p>새 콘텐츠, 문의 답변, GY 운영 소식을 확인합니다.</p></section><section className="panel list-panel">{data?.length ? data.map((item) => <div className={item.is_read ? "customer-list-row" : "customer-list-row unread"} key={item.id}><div><b>{item.title}</b><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString("ko-KR")}</small></div><span className="status-pill">{item.type}</span></div>) : <div className="empty">새로운 알림이 없습니다.</div>}</section></main></div>;
}
