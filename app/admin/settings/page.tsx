import { hasOpenAIEnv, hasSupabaseEnv } from "@/lib/env";
import SystemDiagnostics from "@/components/settings/SystemDiagnostics";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const supabase = hasSupabaseEnv();
  const openai = hasOpenAIEnv();
  return (
    <>
      <div className="admin-top"><div><span className="eyebrow">CONNECT-ONLY SETUP</span><h1>외부 서비스 연결 센터</h1><p>Owner은 키와 계정만 연결하고, 시스템 상태는 여기서 자동 진단합니다.</p></div></div>
      <div className="grid grid-3">
        <div className="panel"><h2>Supabase</h2><div className={`alert ${supabase ? "alert-success" : "alert-warning"}`}>{supabase ? "환경변수 입력 완료" : "환경변수 입력 필요"}</div><p>상품·클릭·콘텐츠·예약·자동화 데이터를 저장합니다.</p></div>
        <div className="panel"><h2>OpenAI</h2><div className={`alert ${openai ? "alert-success" : "alert-warning"}`}>{openai ? "API 키 입력 완료" : "API 키 입력 필요"}</div><p>상품 분석, 블로그, 쇼츠, SEO 콘텐츠를 생성합니다.</p></div>
        <div className="panel"><h2>외부 채널</h2><div className="alert alert-warning">계정별 연결 필요</div><p>쿠팡·테무·네이버·유튜브는 각 플랫폼에서 발급한 공식 권한만 연결합니다.</p></div>
      </div>
      <SystemDiagnostics />
      <div className="panel" style={{ marginTop: 20 }}><h2>외부 계정 연결</h2><p className="help">YouTube·Blogger·Naver·Search Console·Coupang·Temu는 통합 연결센터에서 콜백 주소와 실제 권한을 확인합니다.</p><Link className="button button-primary" href="/admin/connections">통합 연결센터 열기</Link></div>
      <div className="panel" style={{ marginTop: 20 }}><h2>로컬 .env.local 입력 예시</h2><pre className="ai-output">{`NEXT_PUBLIC_SITE_URL=http://localhost:3000\nNEXT_PUBLIC_SUPABASE_URL=여기에_URL\nNEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_ANON_KEY\nOPENAI_API_KEY=여기에_OPENAI_KEY\nOPENAI_MODEL=gpt-5.6-terra`}</pre><p className="help">Vercel 운영 환경의 NEXT_PUBLIC_SITE_URL은 https://gy-nexus-zfpq.vercel.app 입니다. 실제 비밀키는 채팅이나 GitHub에 올리지 마세요.</p></div>
    </>
  );
}
