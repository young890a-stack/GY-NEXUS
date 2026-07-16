import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import LoginForm from "@/components/auth/LoginForm";
export default function LoginPage(){return <div className="shell"><SiteHeader/><main className="auth-wrap"><section className="panel auth-card"><div className="brand-logo-large">GY</div><span className="eyebrow">GY COMPANY OS</span><h1>로그인</h1><p>대표·관리자와 GY 회원이 하나의 안전한 인증 시스템을 사용합니다.</p><LoginForm/><p className="auth-switch">처음 방문하셨나요? <Link href="/signup">회원가입</Link></p></section></main></div>}
