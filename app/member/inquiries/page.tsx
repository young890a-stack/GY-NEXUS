import SiteHeader from "@/components/SiteHeader";
import InquiryForm from "@/components/customer/InquiryForm";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function InquiriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/member/inquiries");
  const { data } = await supabase.from("customer_inquiries").select("id,subject,status,priority,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  return <div className="shell"><SiteHeader /><main className="container section"><section className="member-page-heading"><span className="eyebrow">GY SUPPORT</span><h1>문의 관리</h1><p>새 문의를 등록하고 처리 상태를 확인합니다.</p></section><section className="member-content-grid"><article className="panel"><h2>새 문의</h2><InquiryForm defaultEmail={user.email || ""} /></article><article className="panel list-panel"><h2>문의 내역</h2>{data?.length ? data.map((item) => <div className="customer-list-row" key={item.id}><div><b>{item.subject}</b><small>{new Date(item.created_at).toLocaleString("ko-KR")}</small></div><span className="status-pill">{item.status}</span></div>) : <div className="empty">문의 내역이 없습니다.</div>}</article></section></main></div>;
}
