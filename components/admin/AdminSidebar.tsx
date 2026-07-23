"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GyIcon from "./GyIcon";
import { useAdminLocale } from "./AdminLocale";

type Item = { icon: string; ko: string; en: string; href: string };
type Group = { ko: string; en: string; items: Item[] };

const navigationGroups: Group[] = [
  { ko: "핵심 제작", en: "CORE CREATION", items: [
    { icon: "play", ko: "통합 쇼츠 제작실", en: "All-in-one Shorts Studio", href: "/admin/shorts-hub" },
    { icon: "factory", ko: "블로그 제작실", en: "Blog Studio", href: "/admin/content-factory" },
    { icon: "box", ko: "상품 관리", en: "Product Management", href: "/admin/products" },
  ]},
  { ko: "운영 관리", en: "OPERATIONS", items: [
    { icon: "command", ko: "운영 홈", en: "Operations Home", href: "/admin" },
    { icon: "shield", ko: "품질 검수센터", en: "Quality Control", href: "/admin/quality-center" },
    { icon: "chart", ko: "클릭 통계", en: "Click Analytics", href: "/admin/analytics" },
    { icon: "wallet", ko: "CEO 수익 대시보드", en: "Revenue Dashboard", href: "/admin/revenue-dashboard" },
    { icon: "rocket", ko: "자동 게시", en: "Auto Publishing", href: "/admin/publishing" },
    { icon: "calendar", ko: "예약 생성", en: "Scheduling", href: "/admin/schedules" },
  ]},
  { ko: "회사 AI", en: "COMPANY AI", items: [
    { icon: "building", ko: "AI Company OS v2.0", en: "AI Company OS v2.0", href: "/admin/company-os-v2" },
    { icon: "brain", ko: "Dream Y 전략회의", en: "Dream Y Strategy", href: "/admin/strategy-room" },
    { icon: "message", ko: "AI 운영 비서", en: "AI Operations Copilot", href: "/admin/assistant" },
    { icon: "sparkles", ko: "AI Advisor", en: "AI Advisor", href: "/admin/ai-advisor" },
    { icon: "chart", ko: "예측 엔진", en: "Forecast Engine", href: "/admin/forecast" },
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
  return <aside className={`sidebar premium-sidebar ${mobileOpen ? "mobile-open" : ""}`}><div className="sidebar-ambient" aria-hidden="true" /><div className="sidebar-inner"><div className="mobile-sidebar-head"><Link href="/admin" className="brand admin-brand premium-brand"><span className="brand-mark premium-brand-mark"><span>GY</span><i /></span><span className="brand-copy"><strong>GY COMPANY OS</strong><small>CREATOR OPERATIONS</small></span></Link><button type="button" className="mobile-menu-toggle" aria-expanded={mobileOpen} aria-controls="gy-admin-navigation" onClick={() => setMobileOpen((open) => !open)}><span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span><b>{mobileOpen ? "닫기" : "전체 메뉴"}</b></button></div><div className="locale-switcher" role="group" aria-label="Language selector"><button type="button" className={locale === "ko" ? "active" : ""} onClick={() => setLocale("ko")}>KR</button><button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN</button><span aria-hidden="true" /></div><nav id="gy-admin-navigation" className="side-nav premium-nav" aria-label={locale === "ko" ? "관리자 메뉴" : "Admin navigation"}>{navigationGroups.map((group) => <section className="nav-group" key={group.en}><p className="nav-group-title">{locale === "ko" ? group.ko : group.en}</p><div className="nav-group-list">{group.items.map((item) => { const active = isActivePath(pathname, item.href); return <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)}><span className="nav-icon"><GyIcon name={item.icon} /></span><span className="nav-label">{locale === "ko" ? item.ko : item.en}</span><span className="nav-arrow" aria-hidden="true">›</span></Link>; })}</div></section>)}</nav><div className="sidebar-footer premium-system-card"><span className="status-orbit"><i /></span><div><strong>{locale === "ko" ? "통합 쇼츠 운영" : "Unified Shorts operations"}</strong><small>{locale === "ko" ? "한국형·중국형·외부 도구" : "Korean, China and external tools"}</small></div></div></div></aside>;
}
