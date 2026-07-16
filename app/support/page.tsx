import SiteHeader from "@/components/SiteHeader";
import InquiryForm from "@/components/customer/InquiryForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  let email = "";
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email || "";
  } catch {}
  return <div className="shell"><SiteHeader /><main className="container section"><section className="support-grid"><div><span className="eyebrow">GY SUPPORT</span><h1>무엇을 도와드릴까요?</h1><p>회원과 비회원 모두 문의할 수 있습니다. 접수된 문의는 GY Customer Center에서 관리됩니다.</p><div className="support-points"><article><b>서비스 문의</b><span>회원, 콘텐츠, 상품, 기능 사용 안내</span></article><article><b>오류 신고</b><span>문제가 발생한 화면과 상황을 알려주세요.</span></article><article><b>제휴 및 협업</b><span>GY와 함께할 제안을 남겨주세요.</span></article></div></div><section className="panel"><InquiryForm defaultEmail={email} /></section></section></main></div>;
}
