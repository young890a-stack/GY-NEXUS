import SiteHeader from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function CommentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/member/comments");
  const { data } = await supabase.from("content_comments").select("id,body,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  return <div className="shell"><SiteHeader /><main className="container section"><section className="member-page-heading"><span className="eyebrow">GY ACTIVITY</span><h1>내 댓글</h1><p>작성한 의견과 검토 상태를 확인합니다.</p></section><section className="panel list-panel">{data?.length ? data.map((item) => <div className="customer-list-row" key={item.id}><div><b>{item.body}</b><small>{new Date(item.created_at).toLocaleString("ko-KR")}</small></div><span className="status-pill">{item.status}</span></div>) : <div className="empty">작성한 댓글이 없습니다.</div>}</section></main></div>;
}
