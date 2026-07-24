import SiteHeader from "@/components/SiteHeader";
import PublicVideoGallery from "@/components/public/PublicVideoGallery";
import { getPublicShowcaseVideos } from "@/lib/public-showcase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "쇼핑 쇼츠 영상 포트폴리오",
  description: "상품 판매를 위해 제작한 쇼핑 쇼츠와 광고 영상 포트폴리오",
};

export default async function ShowcasePage() {
  const videos = await getPublicShowcaseVideos(30);

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb" }}>
      <SiteHeader />
      <main className="container section" style={{ paddingTop: 140, paddingBottom: 100 }}>
        <div className="section-head" style={{ marginBottom: 36 }}>
          <div>
            <span className="eyebrow">GY VIDEO PORTFOLIO</span>
            <h1 style={{ marginTop: 12 }}>쇼핑 쇼츠·상품 광고 영상</h1>
            <p>사이트 안에서 영상을 직접 재생하고, 상품 확인 또는 광고 제작 문의로 바로 이동할 수 있습니다.</p>
          </div>
        </div>
        <PublicVideoGallery videos={videos} />
      </main>
    </div>
  );
}
