import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth/owner";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const ownerConfigured = Boolean(process.env.OWNER_EMAIL?.trim());
  if (ownerConfigured && !isOwner(user)) redirect("/member");

  return <div className="admin-shell"><AdminSidebar /><main className="admin-main"><AdminTopbar /><div className="admin-content-wrap">{children}</div></main></div>;
}
