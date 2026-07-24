"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function SiteHeader() {
  const [owner, setOwner] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    fetch("/api/auth/access", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { owner?: boolean } | null) => {
        if (active) setOwner(Boolean(data?.owner));
      })
      .catch(() => {
        if (active) setOwner(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="site-header gy-site-header">
      <div className="container header-inner">
        <Link href="/" className="brand gy-brand" aria-label="GY Labs 홈">
          <span className="brand-mark">GY</span>
          <span className="gy-brand-copy">
            <strong>GY LABS</strong>
            <small>Shorts & Commerce</small>
          </span>
        </Link>
        <button
          type="button"
          className="gy-menu-button"
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={menuOpen}
          aria-controls="gy-public-menu"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav
          id="gy-public-menu"
          className={`nav gy-public-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="주요 메뉴"
        >
          <Link href="/showcase" aria-current={pathname === "/showcase" ? "page" : undefined}>영상 포트폴리오</Link>
          <Link href="/products" aria-current={pathname.startsWith("/products") ? "page" : undefined}>추천 상품</Link>
          <Link href="/support?type=ad" aria-current={pathname === "/support" ? "page" : undefined}>광고 제작 문의</Link>
          <Link href="/member" aria-current={pathname.startsWith("/member") ? "page" : undefined}>고객센터</Link>
          {owner && <Link href="/admin/revenue-shorts">영상 제작실</Link>}
          {owner && <Link href="/admin" className="gy-nav-cta">운영센터 <b>↗</b></Link>}
        </nav>
      </div>
    </header>
  );
}
