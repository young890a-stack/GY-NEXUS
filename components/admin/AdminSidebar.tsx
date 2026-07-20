"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import GyIcon from "./GyIcon";
import { useAdminLocale } from "./AdminLocale";

type Item = { icon: string; ko: string; en: string; href: string };
type Group = { ko: string; en: string; items: Item[] };

const navigationGroups: Group[] = [
  {
    ko: "COMMAND",
    en: "COMMAND",
    items: [
      { icon: "command", ko: "GY 명령센터", en: "GY Command Center", href: "/admin" },
      { icon: "shield", ko: "품질 검수센터", en: "Quality Control", href: "/admin/quality-center" },
      { icon: "target", ko: "게시 전략센터", en: "Publishing Strategy", href: "/admin/publishing-strategy" },
      { icon: "building", ko: "AI Company OS v2.0", en: "AI Company OS v2.0", href: "/admin/company-os-v2" },
      { icon: "command", ko: "Company OS 1.0 보관", en: "Company OS 1.0 Archive", href: "/admin/company-os" },
      { icon: "brain", ko: "Dream Y 전략회의", en: "Dream Y Strategy", href: "/admin/strategy-room" },
      { icon: "message", ko: "AI 운영 비서", en: "AI Operations Copilot", href: "/admin/assistant" },
      { icon: "sparkles", ko: "Evolution Room", en: "Evolution Room", href: "/admin/evolution-room" },
      { icon: "database", ko: "회사 기억센터", en: "Company Memory", href: "/admin/memory" },
      { icon: "chart", ko: "클릭 통계", en: "Click Analytics", href: "/admin/analytics" },
      { icon: "wallet", ko: "CEO 수익 대시보드", en: "Revenue Dashboard", href: "/admin/revenue-dashboard" },
      { icon: "brain", ko: "AI 학습 엔진", en: "Learning Engine", href: "/admin/learning-engine" },
      { icon: "sparkles", ko: "AI Advisor", en: "AI Advisor", href: "/admin/ai-advisor" },
      { icon: "chart", ko: "예측 엔진", en: "Forecast Engine", href: "/admin/forecast" },
      { icon: "wallet", ko: "기존 매출 분석", en: "Legacy Revenue", href: "/admin/revenue" },
      { icon: "growth", ko: "성장 인텔리전스", en: "Growth Intelligence", href: "/admin/growth" },
    ],
  },
  {
    ko: "CONTENT",
    en: "CONTENT",
    items: [
      { icon: "rocket", ko: "GY Revenue Shorts OS", en: "GY Revenue Shorts OS", href: "/admin/revenue-shorts" },
      { icon: "box", ko: "상품 관리", en: "Product Management", href: "/admin/products" },
      { icon: "plus", ko: "상품 등록", en: "Add Product", href: "/admin/products/new" },
      { icon: "download", ko: "상품 자동 등록", en: "Product Import", href: "/admin/import" },
      { icon: "factory", ko: "AI 콘텐츠 공장", en: "AI Content Factory", href: "/admin/content-factory" },
      { icon: "search", ko: "중국 영상 연구소", en: "China Video Lab", href: "/admin/china-video-lab" },
      { icon: "play", ko: "쇼핑쇼츠 제작실", en: "Shopping Shorts Studio", href: "/admin/shopping-shorts" },
      { icon: "palette", ko: "Creative Studio", en: "Creative Studio", href: "/admin/creative-studio" },
      { icon: "sparkles", ko: "Creative Studio Pro", en: "Creative Studio Pro", href: "/admin/creative-studio-pro" },
      { icon: "dna", ko: "Product DNA Engine", en: "Product DNA Engine", href: "/admin/product-dna" },
      { icon: "search", ko: "SEO Studio", en: "SEO Studio", href: "/admin/seo-studio" },
      { icon: "bot", ko: "AI 콘텐츠", en: "AI Content", href: "/admin/content" },
      { icon: "history", ko: "생성 이력", en: "Generation History", href: "/admin/content/history" },
    ],
  },
  {
    ko: "AUTOMATION",
    en: "AUTOMATION",
    items: [
      { icon: "flame", ko: "상품 기회 분석센터", en: "Product Opportunity", href: "/admin/product-intelligence" },
      { icon: "search", ko: "단일 상품 AI 분석", en: "Single Product AI", href: "/admin/trends" },
      { icon: "zap", ko: "원터치 자동화", en: "One-touch Automation", href: "/admin/automation" },
      { icon: "rocket", ko: "자동 게시", en: "Auto Publishing", href: "/admin/publishing" },
      { icon: "play", ko: "YouTube 업로드", en: "YouTube Upload", href: "/admin/youtube" },
      { icon: "calendar", ko: "예약 생성", en: "Scheduling", href: "/admin/schedules" },
    ],
  },
  {
    ko: "SYSTEM",
    en: "SYSTEM",
    items: [
      { icon: "palette", ko: "GY Brand Center", en: "GY Brand Center", href: "/admin/brand-center" },
      { icon: "compass", ko: "설치 마법사", en: "Setup Wizard", href: "/admin/setup" },
      { icon: "link", ko: "통합 연결센터", en: "Connection Center", href: "/admin/connections" },
      { icon: "shield", ko: "운영 상태", en: "System Status", href: "/admin/system-status" },
      { icon: "settings", ko: "설정 안내", en: "Settings", href: "/admin/settings" },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/products") return pathname === href;
  if (href === "/admin/content") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const { locale, setLocale } = useAdminLocale();

  return (
    <aside className="sidebar premium-sidebar">
      <div className="sidebar-ambient" aria-hidden="true" />
      <div className="sidebar-inner">
        <Link href="/admin" className="brand admin-brand premium-brand">
          <span className="brand-mark premium-brand-mark"><span>GY</span><i /></span>
          <span className="brand-copy">
            <strong>GY COMPANY OS</strong>
            <small>AI COMPANY OS · 2.0</small>
          </span>
        </Link>

        <div className="locale-switcher" role="group" aria-label="Language selector">
          <button type="button" className={locale === "ko" ? "active" : ""} onClick={() => setLocale("ko")}>KR</button>
          <button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN</button>
          <span aria-hidden="true" />
        </div>

        <nav className="side-nav premium-nav" aria-label={locale === "ko" ? "관리자 메뉴" : "Admin navigation"}>
          {navigationGroups.map((group) => (
            <section className="nav-group" key={group.en}>
              <p className="nav-group-title">{locale === "ko" ? group.ko : group.en}</p>
              <div className="nav-group-list">
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
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
            <strong>{locale === "ko" ? "운영 시스템 정상" : "System operational"}</strong>
            <small>{locale === "ko" ? "Dream Y Core 가동 중" : "Dream Y Core is online"}</small>
          </div>
          <span className="system-percent">99.9%</span>
        </div>
      </div>
    </aside>
  );
}
