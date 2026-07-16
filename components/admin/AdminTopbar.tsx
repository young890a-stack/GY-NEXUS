"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const labels: Array<[string, string]> = [
  ["/admin/company-os", "GY Command Center"],
  ["/admin/quality-center", "GY Quality"],
  ["/admin/publishing-strategy", "GY Publishing Strategy"],
  ["/admin/product-dna", "GY DNA"],
  ["/admin/creative-studio-pro", "GY Studio Pro"],
  ["/admin/growth", "GY Growth"],
  ["/admin/connections", "GY Connections"],
  ["/admin/brand-center", "GY Brand Center"],
  ["/admin", "GY Command Center"],
];

function resolveTitle(pathname: string) {
  return labels.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? "GY Company OS";
}

export default function AdminTopbar() {
  const pathname = usePathname();
  const title = resolveTitle(pathname);

  return (
    <header className="admin-topbar">
      <div>
        <span className="admin-topbar-kicker">GY COMPANY OS</span>
        <strong>{title}</strong>
      </div>
      <div className="admin-topbar-actions">
        <span className="owner-status"><i />Owner mode</span>
        <Link href="/" className="button button-light admin-public-link">고객 화면</Link>
      </div>
    </header>
  );
}
