import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function BookmarksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/member/bookmarks");
  const { data } = await supabase.from("content_bookmarks").select("id,content_id,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  return <div className="shell"><SiteHeader /><main className="container section"><section className="member-page-heading"><span className="eyebrow">GY BOOKMARKS</span><h1>저장한 콘텐츠</h1><p>다시 보고 싶은 콘텐츠를 한곳에서 관리합니다.</p></section><section className="panel list-panel">{data?.length ? data.map((item) => <div className="customer-list-row" key={item.id}><div><b>콘텐츠 {item.content_id}</b><small>{new Date(item.created_at).toLocaleDateString("ko-KR")}</small></div><Link href="/discover">콘텐츠 보기 →</Link></div>) : <div className="empty">저장한 콘텐츠가 없습니다.</div>}</section></main></div>;
}
