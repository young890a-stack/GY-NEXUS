import AdminSidebar from "@/components/admin/AdminSidebar";
import { AdminLocaleProvider } from "@/components/admin/AdminLocale";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLocaleProvider>
      <div className="admin-shell production-shell">
        <AdminSidebar />
        <main className="admin-main">
          <div className="admin-content-wrap">{children}</div>
        </main>
      </div>
    </AdminLocaleProvider>
  );
}
