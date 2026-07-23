"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GyIcon from "./GyIcon";
import { useAdminLocale } from "./AdminLocale";

type Item = { icon: string; ko: string; en: string; href: string };
type Group = { ko: string; en: string; items: Item[] };

const navigationGroups: Group[] = [
  { ko: "핵심 사업", en: "CORE BUSINESS", items: [
    { icon: "play", ko: "쇼핑 쇼츠 AI 캔버스", en: "Shopping Shorts AI Canvas", href: "/admin/shorts-hub" },
    { icon: "factory", ko: "블로그 제작실", en: "Blog Studio", href: "/admin/content-factory" },
    { icon: "box", ko: "상품·제휴링크", en: "Products & Affiliate Links", href: "/admin/products" },
  ]},
  { ko: "운영과 수익", en: "OPERATIONS & REVENUE", items: [
    { icon: "command", ko: "운영 홈", en: "Operations Home", href: "/admin" },
    { icon: "shield", ko: "품질 검수", en: "Quality Control", href: "/admin/quality-center" },
    { icon: "rocket", ko: "게시센터", en: "Publishing Center", href: "/admin/publishing" },
    { icon: "chart", ko: "조회수·클릭 분석", en: "Views & Click Analytics", href: "/admin/analytics" },
    { icon: "wallet", ko: "수익 대시보드", en: "Revenue Dashboard", href: "/admin/revenue-dashboard" },
  ]},
  { ko: "회사 AI · 단계별 보완", en: "COMPANY AI · IMPROVE LATER", items: [
    { icon: "building", ko: "AI Company OS", en: "AI Company OS", href: "/admin/company-os-v2" },
    { icon: "brain", ko: "Dream Y 전략회의", en: "Dream Y Strategy", href: "/admin/strategy-room" },
    { icon: "message", ko: "AI 운영 비서", en: "AI Operations Copilot", href: "/admin/assistant" },
    { icon: "sparkles", ko: "AI Advisor", en: "AI Advisor", href: "/admin/ai-advisor" },
    { icon: "growth", ko: "성장 인텔리전스", en: "Growth Intelligence", href: "/admin/growth" },
    { icon: "brain", ko: "AI 학습 엔진", en: "Learning Engine", href: "/admin/learning-engine" },
  ]},
  { ko: "연결 및 설정", en: "SYSTEM", items: [
    { icon: "link", ko: "통합 연결센터", en: "Connection Center", href: "/admin/connections" },
    { icon: "shield", ko: "운영 상태", en: "System Status", href: "/admin/system-status" },
    { icon: "settings", ko: "설정", en: "Settings", href: "/admin/settings" },
  ]},
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/products") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const { locale, setLocale } = useAdminLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <aside className={`sidebar premium-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-ambient" aria-hidden="true" />
      <div className="sidebar-inner">
        <div className="mobile-sidebar-head">
          <Link href="/admin" className="brand admin-brand premium-brand">
            <span className="brand-mark premium-brand-mark"><span>GY</span><i /></span>
            <span className="brand-copy"><strong>GY COMPANY OS</strong><small>SHORTS · BLOG · REVENUE</small></span>
          </Link>
          <button type="button" className="mobile-menu-toggle" aria-expanded={mobileOpen} aria-controls="gy-admin-navigation" onClick={() => setMobileOpen((open) => !open)}>
            <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span><b>{mobileOpen ? "닫기" : "전체 메뉴"}</b>
          </button>
        </div>
        <div className="locale-switcher" role="group" aria-label="Language selector">
          <button type="button" className={locale === "ko" ? "active" : ""} onClick={() => setLocale("ko")}>KR</button>
          <button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN</button>
          <span aria-hidden="true" />
        </div>
        <nav id="gy-admin-navigation" className="side-nav premium-nav" aria-label={locale === "ko" ? "관리자 메뉴" : "Admin navigation"}>
          {navigationGroups.map((group) => (
            <section className="nav-group" key={group.en}>
              <p className="nav-group-title">{locale === "ko" ? group.ko : group.en}</p>
              <div className="nav-group-list">
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)}>
                      <span className="nav-icon"><GyIcon name={item.icon} /></span>
                      <span className="nav-label">{locale === "ko" ? item.ko : item.en}</span>
                      <span className="nav-arrow" aria-hidden="true">›</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="sidebar-footer premium-system-card">
          <span className="status-orbit"><i /></span>
          <div>
            <strong>{locale === "ko" ? "쇼핑 쇼츠 우선 운영" : "Shopping Shorts first"}</strong>
            <small>{locale === "ko" ? "상품에서 수익까지 한 프로젝트" : "One project from product to revenue"}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
