import SiteHeader from "@/components/SiteHeader";
import MemberDashboard from "@/components/member/MemberDashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function MemberPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/member");

  const [{ data: profile }, bookmarks, comments, notifications, inquiries] = await Promise.all([
    supabase.from("profiles").select("display_name,role,interests").eq("id", user.id).maybeSingle(),
    supabase.from("content_bookmarks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("content_comments").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("customer_notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
    supabase.from("customer_inquiries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const name = String(profile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "회원");
  const interests = Array.isArray(profile?.interests) ? profile.interests.map(String) : [];
  const role = String(profile?.role || user.user_metadata?.role || "member");

  return <div className="shell"><SiteHeader /><main className="container section"><MemberDashboard name={name} role={role} interests={interests} bookmarks={bookmarks.count || 0} comments={comments.count || 0} notifications={notifications.count || 0} inquiries={inquiries.count || 0} /></main></div>;
}
