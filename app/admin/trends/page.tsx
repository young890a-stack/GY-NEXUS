import TrendEngine from "@/components/trends/TrendEngine";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("trend_products")
    .select("*")
    .order("ai_score", { ascending: false })
    .order("collected_at", { ascending: false })
    .limit(100);

  return (
    <div className="admin-page">
      <div className="admin-top">
        <div>
          <span className="eyebrow">AI PRODUCT ANALYSIS ENGINE</span>
          <h1>AI 상품 분석 엔진</h1>
          <p>상품 링크 하나로 핵심 정보와 판매 가능성을 분석하고, 콘텐츠 제작 단계까지 연결합니다.</p>
        </div>
      </div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          {error.message}<br />Supabase SQL Editor에서 프로젝트의 supabase/schema.sql을 실행했는지 확인하세요.
        </div>
      )}
      <TrendEngine items={(data || []) as never[]} />
    </div>
  );
}
