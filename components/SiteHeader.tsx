import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="site-header gy-site-header">
      <div className="container header-inner">
        <Link href="/" className="brand gy-public-brand" aria-label="GY 홈으로 이동">
          <span className="brand-mark">GY</span>
          <span className="brand-copy-public">
            <strong>GY</strong>
            <small>FIRST RELEASE PRODUCTION</small>
          </span>
        </Link>

        <nav className="nav gy-public-nav" aria-label="주요 메뉴">
          <Link href="/products">Products</Link>
          <Link href="/admin/content-factory">Studio</Link>
          <Link href="/discover">Content</Link>
          <Link href="/admin/growth">Growth</Link>
        </nav>

        <div className="gy-header-actions">
          <Link href="/login" className="gy-header-login">로그인</Link>
          <Link href="/admin" className="gy-header-cta">GY 시작하기</Link>
        </div>
      </div>
    </header>
  );
}
