import SiteHeader from "@/components/SiteHeader";
import MemberDashboard from "@/components/member/MemberDashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function MemberPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/member");
  const name = String(user.user_metadata?.display_name || user.email?.split("@")[0] || "회원");
  return <div className="shell"><SiteHeader /><main className="container section"><MemberDashboard name={name} /></main></div>;
}
