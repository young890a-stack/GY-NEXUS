import Sprint7ControlCenter from "@/components/product-intelligence/Sprint7ControlCenter";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function ProductIntelligencePage(){
 const supabase=await createClient();
 const {data,error}=await supabase.from("trend_products").select("id,title,platform,ai_score,opportunity_grade,opportunity_recommendation,status,price_text,affiliate_url,ai_summary,shorts_hook,caution").order("ai_score",{ascending:false}).order("collected_at",{ascending:false}).limit(100);
 return <div className="admin-page"><div className="admin-top"><div><span className="eyebrow">GY-NEXUS ULTIMATE v7.0 · SPRINT 7</span><h1>Product Intelligence Engine</h1><p>무엇을 팔지 결정하고, 우선순위를 계산하고, 정식 상품으로 전환하는 AI 상품 두뇌입니다.</p></div></div>{error&&<div className="alert alert-error" style={{marginBottom:20}}>{error.message}<br/>supabase/SPRINT-7-MIGRATION.sql을 먼저 실행하세요.</div>}<Sprint7ControlCenter items={(data||[]) as never[]}/></div>;
}
