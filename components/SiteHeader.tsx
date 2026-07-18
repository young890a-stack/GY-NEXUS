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
        <Link href="/" className="brand gy-brand" aria-label="GY 홈">
          <span className="brand-mark">GY</span>
          <span className="gy-brand-copy">
            <strong>GY</strong>
            <small>Company OS</small>
          </span>
        </Link>
        <nav className="nav gy-public-nav" aria-label="주요 메뉴">
          <Link href="/discover">Content</Link>
          <Link href="/products">Products</Link>
          <Link href="/pricing">Plans</Link>
          <Link href="/member">My GY</Link>
          {owner && <Link href="/admin/ai-factory">AI Factory</Link>}
          {owner && <Link href="/admin" className="gy-nav-cta">Open GY <b>↗</b></Link>}
        </nav>
      </div>
    </header>
  );
}
