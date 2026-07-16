"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationGroups = [
  {
    label: "운영 현황",
    items: [
      ["🏠", "GY Command Center", "/admin"],
      ["🛡️", "품질 검수센터", "/admin/quality-center"],
      ["🎯", "게시 전략센터", "/admin/publishing-strategy"],
      ["🏢", "GY Company OS", "/admin/company-os"],
      ["🧠", "Dream Y 전략회의", "/admin/strategy-room"],
      ["💬", "AI 운영 비서", "/admin/assistant"],
      ["🧬", "Evolution Room", "/admin/evolution-room"],
      ["🗃️", "회사 기억센터", "/admin/memory"],
      ["📊", "클릭 통계", "/admin/analytics"],
      ["💰", "매출 분석", "/admin/revenue"],
      ["📈", "성장 인텔리전스", "/admin/growth"],
    ],
  },
  {
    label: "상품과 콘텐츠",
    items: [
      ["📦", "상품 관리", "/admin/products"],
      ["➕", "상품 등록", "/admin/products/new"],
      ["📥", "상품 자동 등록", "/admin/import"],
      ["🏭", "AI 콘텐츠 공장", "/admin/content-factory"],
      ["🎨", "Creative Studio", "/admin/creative-studio"],
      ["🎬", "Creative Studio Pro", "/admin/creative-studio-pro"],
      ["🧬", "Product DNA Engine", "/admin/product-dna"],
      ["📈", "SEO Studio", "/admin/seo-studio"],
      ["🤖", "AI 콘텐츠", "/admin/content"],
      ["📚", "생성 이력", "/admin/content/history"],
    ],
  },
  {
    label: "자동화",
    items: [
      ["🔥", "상품 기회 분석센터", "/admin/product-intelligence"],
      ["🔎", "단일 상품 AI 분석", "/admin/trends"],
      ["⚡", "원터치 자동화", "/admin/automation"],
      ["🚀", "자동 게시", "/admin/publishing"],
      ["▶️", "YouTube 업로드", "/admin/youtube"],
      ["🗓️", "예약 생성", "/admin/schedules"],
    ],
  },
  {
    label: "연결과 설정",
    items: [
      ["🎨", "GY Brand Center", "/admin/brand-center"],
      ["🧭", "설치 마법사", "/admin/setup"],
      ["🔗", "통합 연결센터", "/admin/connections"],
      ["⚙️", "설정 안내", "/admin/settings"],
    ],
  },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/products") return pathname === href;
  if (href === "/admin/content") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <Link href="/admin" className="brand admin-brand">
          <span className="brand-mark">GY</span>
          <span className="brand-copy">
            <strong>GY COMPANY OS</strong>
            <small>FIRST RELEASE PRODUCTION · 1.0</small>
          </span>
        </Link>

        <nav className="side-nav" aria-label="관리자 메뉴">
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
            <strong>운영 시스템</strong>
            <small>GY Core · 정상 가동</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
