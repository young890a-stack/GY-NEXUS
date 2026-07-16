import Link from "next/link";

export default function SiteHeader() {
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
          <Link href="/member">My GY</Link>
          <Link href="/admin/ai-factory">AI Factory</Link>
          <Link href="/admin" className="gy-nav-cta">Open GY <b>↗</b></Link>
        </nav>
      </div>
    </header>
  );
}
