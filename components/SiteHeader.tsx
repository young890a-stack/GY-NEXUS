"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SiteHeader() {
  const [owner, setOwner] = useState(false);

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
        <nav className="nav gy-public-nav" aria-label="주요 메뉴">
          <Link href="/showcase">영상 포트폴리오</Link>
          <Link href="/products">추천 상품</Link>
          <Link href="/support?type=ad">광고 제작 문의</Link>
          <Link href="/member">고객센터</Link>
          {owner && <Link href="/admin/revenue-shorts">영상 제작실</Link>}
          {owner && <Link href="/admin" className="gy-nav-cta">운영센터 <b>↗</b></Link>}
        </nav>
      </div>
    </header>
  );
}
