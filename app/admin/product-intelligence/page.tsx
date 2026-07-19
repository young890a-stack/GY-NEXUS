import ProductIntelligenceControlCenter from "@/components/product-intelligence/ProductIntelligenceControlCenter";
import AffiliateProductHub from "@/components/product-intelligence/AffiliateProductHub";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ProductIntelligencePage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("trend_products")
    .select("id,title,platform,ai_score,opportunity_grade,opportunity_recommendation,status,price_text,affiliate_url,ai_summary,shorts_hook,caution,collected_at,link_status,data_quality_score,provider_mode,last_seen_at")
    .order("ai_score", { ascending: false })
    .order("collected_at", { ascending: false })
    .limit(200);

  return (
    <div className="admin-page">
      <div className="admin-top">
        <div>
          <span className="eyebrow">GY-NEXUS AI COMPANY OS v2.0 · SPRINT 2</span>
          <h1>Product Intelligence</h1>
          <p>승인된 상품 데이터와 제휴 링크를 수집하고, 기회점수로 우선순위를 정한 뒤 대표 승인으로 정식 상품화합니다.</p>
        </div>
      </div>
      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error.message}<br />supabase/AFFILIATE-PRODUCT-SOURCING-MIGRATION.sql을 먼저 실행하세요.</div>}
      <AffiliateProductHub />
      <ProductIntelligenceControlCenter items={(data || []) as never[]} />
    </div>
  );
}
