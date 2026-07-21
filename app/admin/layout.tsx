import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminMobileDock from "@/components/admin/AdminMobileDock";
import { AdminLocaleProvider } from "@/components/admin/AdminLocale";
import { isOwner } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");
  if (!isOwner(user)) redirect("/member?error=owner_only");

  return (
    <AdminLocaleProvider>
      <div className="admin-shell production-shell">
        <AdminSidebar />
        <main className="admin-main">
          <div className="admin-content-wrap">{children}</div>
        </main>
        <AdminMobileDock />
      </div>
    </AdminLocaleProvider>
  );
}
