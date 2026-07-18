import SiteHeader from "@/components/SiteHeader";
import MemberDashboard from "@/components/member/MemberDashboard";
import MemberAiStudio from "@/components/member/MemberAiStudio";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function MemberPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/member");
  const name = String(user.user_metadata?.display_name || user.email?.split("@")[0] || "회원");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [bookmarks, views, notifications, profile] = await Promise.all([
    supabase.from("content_bookmarks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("content_views").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("viewed_at", thirtyDaysAgo),
    supabase.from("customer_notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
    supabase.from("profiles").select("interests").eq("id", user.id).maybeSingle(),
  ]);
  const interests = Array.isArray(profile.data?.interests) && profile.data.interests.length
    ? profile.data.interests.map(String).slice(0, 8)
    : ["AI", "재테크", "부업", "IT", "쇼핑"];
  return <div className="shell"><SiteHeader /><main className="container section"><MemberDashboard name={name} stats={{ bookmarks: bookmarks.count || 0, recentViews: views.count || 0, notifications: notifications.count || 0 }} interests={interests} /><MemberAiStudio /></main></div>;
}
