"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationGroups = [
  {
    label: "Company",
    items: [
      ["◇", "Command Center", "/admin"],
      ["◎", "Company OS", "/admin/company-os"],
      ["✦", "Dream Y", "/admin/assistant"],
      ["◫", "Strategy", "/admin/strategy-room"],
    ],
  },
  {
    label: "Create",
    items: [
      ["⬡", "GY DNA", "/admin/product-dna"],
      ["▣", "Products", "/admin/products"],
      ["✎", "Content Factory", "/admin/content-factory"],
      ["◈", "Studio Pro", "/admin/creative-studio-pro"],
      ["△", "SEO Studio", "/admin/seo-studio"],
    ],
  },
  {
    label: "Operate",
    items: [
      ["↗", "Publishing", "/admin/publishing"],
      ["◷", "Schedules", "/admin/schedules"],
      ["⚡", "Automation", "/admin/automation"],
      ["✓", "Quality", "/admin/quality-center"],
      ["⌁", "Growth", "/admin/growth"],
    ],
  },
  {
    label: "System",
    items: [
      ["∞", "Connections", "/admin/connections"],
      ["◉", "Analytics", "/admin/analytics"],
      ["◆", "Brand Center", "/admin/brand-center"],
      ["⚙", "Settings", "/admin/settings"],
    ],
  },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <Link href="/admin" className="brand admin-brand" aria-label="GY Company OS 홈">
          <span className="brand-mark">GY</span>
          <span className="brand-copy">
            <strong>GY</strong>
            <small>COMPANY OS · 1.0</small>
          </span>
        </Link>

        <nav className="side-nav" aria-label="GY 운영 메뉴">
          {navigationGroups.map((group) => (
            <section className="nav-group" key={group.label}>
              <p className="nav-group-title">{group.label}</p>
              <div className="nav-group-list">
                {group.items.map(([icon, label, href]) => {
                  const active = isActivePath(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={active ? "active" : undefined}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="nav-icon">{icon}</span>
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          <div>
            <strong>GY Core Online</strong>
            <small>Dream Y engine active</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
