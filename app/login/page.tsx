import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import LoginForm from "@/components/auth/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <div className="shell"><SiteHeader/><main className="auth-wrap"><section className="panel auth-card"><div className="brand-logo-large">GY</div><span className="eyebrow">GY COMPANY OS</span><h1>로그인</h1><p>회원과 Creator는 하나의 안전한 GY 계정으로 서비스를 이용합니다.</p><LoginForm nextPath={params.next}/><p className="auth-switch">처음 방문하셨나요? <Link href="/signup">회원가입</Link></p></section></main></div>;
}
