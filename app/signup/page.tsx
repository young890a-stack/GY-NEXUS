import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SignupForm from "@/components/auth/SignupForm";

export default function SignupPage() {
  return <div className="shell"><SiteHeader /><main className="auth-wrap"><section className="panel auth-card"><span className="eyebrow">GY CUSTOMER PLATFORM</span><h1>GY 회원가입</h1><p>관심 콘텐츠를 저장하고, 맞춤 추천과 새 소식을 받아보세요.</p><SignupForm /><p className="auth-switch">이미 회원인가요? <Link href="/login">로그인</Link></p></section></main></div>;
}
