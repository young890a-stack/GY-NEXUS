import SiteHeader from "@/components/SiteHeader";
import InquiryForm from "@/components/customer/InquiryForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "쇼핑 쇼츠·광고 영상 제작 문의 · GY Labs",
  description: "상품 판매를 위한 쇼핑 쇼츠, 광고 영상, 콘텐츠 운영 대행 상담",
};

export default async function SupportPage() {
  let email = "";
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email || "";
  } catch {}

  return (
    <div className="shell">
      <SiteHeader />
      <main className="container section" style={{ paddingTop: 140 }}>
        <section className="support-grid">
          <div>
            <span className="eyebrow">GY SALES VIDEO AGENCY</span>
            <h1>상품을 팔기 위한<br />영상을 의뢰하세요.</h1>
            <p>상품 링크와 원하는 방향을 알려주시면 쇼핑 쇼츠, 광고 영상, 정확한 자막, 썸네일과 판매 문구까지 함께 설계합니다.</p>
            <div className="support-points">
              <article><b>쇼핑 쇼츠 제작</b><span>15~30초 영상·대본·자막·썸네일</span></article>
              <article><b>상품 광고 영상</b><span>사용 장면과 판매 포인트 중심 광고 소재</span></article>
              <article><b>콘텐츠 운영 대행</b><span>유튜브 쇼츠·인스타 릴스 반복 운영</span></article>
            </div>
          </div>
          <section className="panel"><InquiryForm defaultEmail={email} /></section>
        </section>
      </main>
    </div>
  );
}
