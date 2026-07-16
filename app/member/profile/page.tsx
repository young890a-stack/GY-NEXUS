import SiteHeader from "@/components/SiteHeader";
import ProfileForm from "@/components/customer/ProfileForm";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/member/profile");
  const { data } = await supabase.from("profiles").select("display_name,role,interests").eq("id", user.id).maybeSingle();
  const interests = Array.isArray(data?.interests) ? data.interests.map(String) : [];
  return <div className="shell"><SiteHeader /><main className="container section member-narrow"><ProfileForm id={user.id} displayName={String(data?.display_name || user.user_metadata?.display_name || "")} role={String(data?.role || user.user_metadata?.role || "member")} interests={interests} /></main></div>;
}
