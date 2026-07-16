import { hasOpenAIEnv, hasSupabaseEnv } from "@/lib/env";
import SystemDiagnostics from "@/components/settings/SystemDiagnostics";

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
      <div className="panel" style={{ marginTop: 20 }}><h2>.env.local 입력 형식</h2><pre className="ai-output">{`NEXT_PUBLIC_SUPABASE_URL=여기에_URL\nNEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_ANON_KEY\nOPENAI_API_KEY=여기에_OPENAI_KEY\nOPENAI_MODEL=gpt-5.5`}</pre><p className="help">실제 비밀키는 채팅에 올리지 말고 Owner 컴퓨터의 .env.local에만 입력하세요.</p></div>
    </>
  );
}
