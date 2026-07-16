import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">GY</span>
          <span className="brand-copy-public"><strong>GY Company OS</strong><small>Powered by Dream Y</small></span>
        </Link>
        <nav className="nav">
          <Link href="/discover">콘텐츠</Link>
          <Link href="/products">추천 상품</Link>
          <Link href="/member">마이페이지</Link>
          <Link href="/admin">대표 상황실</Link>
        </nav>
      </div>
    </header>
  );
}
