import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";

export default async function SiteHeader() {
  let user: { email?: string } | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user ? { email: data.user.email } : null;
  } catch {}

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand"><span className="brand-mark">GY</span><span className="brand-copy-public"><strong>GY</strong><small>COMPANY OS</small></span></Link>
        <nav className="nav">
          <Link href="/discover">콘텐츠</Link>
          <Link href="/products">상품</Link>
          <Link href="/support">고객지원</Link>
          {user ? <><Link href="/member">마이페이지</Link><LogoutButton compact /></> : <><Link href="/login">로그인</Link><Link href="/signup" className="nav-cta">회원가입</Link></>}
        </nav>
      </div>
    </header>
  );
}
