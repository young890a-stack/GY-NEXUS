import GrowthDashboard from "@/components/growth/GrowthDashboard";

export const dynamic = "force-dynamic";

export default function GrowthPage() {
  return (
    <div className="admin-page">
      <div className="admin-top">
        <div>
          <span className="eyebrow">SPRINT 9 · GROWTH INTELLIGENCE</span>
          <h1>성장 인텔리전스</h1>
          <p>Google Search Console과 GA4를 통합해 검색 성과, 방문자 행동, 인기 페이지를 한 화면에서 분석합니다.</p>
        </div>
      </div>
      <GrowthDashboard />
    </div>
  );
}
