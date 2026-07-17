import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateOpportunity } from "@/lib/product-intelligence/opportunity";

type InputItem = {
  title?: string;
  platform?: string;
  affiliate_url?: string;
  description?: string;
  image_url?: string;
  price_text?: string;
  category?: string;
  keyword?: string;
  demand?: number;
  seasonality?: number;
  priceAppeal?: number;
  visualDemo?: number;
  audienceFit?: number;
  commissionPotential?: number;
  competition?: number;
  policyRisk?: number;
  dataConfidence?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { items?: InputItem[]; sourceName?: string };
    const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
    if (!items.length) {
      return NextResponse.json({ success: false, message: "수집할 상품 후보가 없습니다." }, { status: 400 });
    }

    const sourceName = String(body.sourceName || "sprint2_collector").trim().slice(0, 80) || "sprint2_collector";
    const now = new Date().toISOString();
    const rows = items.map((item, index) => {
      const title = String(item.title || "").trim();
      const affiliateUrl = String(item.affiliate_url || "").trim();
      if (!title || !affiliateUrl) throw new Error(`${index + 1}번째 후보의 상품명 또는 제휴 링크가 비어 있습니다.`);
      const opportunity = calculateOpportunity(item);
      const keyword = String(item.keyword || item.category || title).trim();
      return {
        title,
        description: String(item.description || "").trim(),
        image_url: String(item.image_url || "").trim() || null,
        affiliate_url: affiliateUrl,
        platform: String(item.platform || "etc").trim().toLowerCase(),
        price_text: String(item.price_text || "").trim(),
        source_name: sourceName,
        external_rank: index + 1,
        external_score: opportunity.score,
        trend_score: opportunity.score,
        status: "analyzed",
        ai_score: opportunity.score,
        opportunity_grade: opportunity.grade,
        opportunity_recommendation: opportunity.recommendation,
        ai_summary: `${opportunity.grade}등급 · ${opportunity.recommendation}. ${opportunity.reasons.join(" ")}`,
        target_audience: "20~40대 실용 소비자",
        selling_points: opportunity.reasons,
        seo_keywords: [keyword, `${keyword} 추천`, `${keyword} 사용법`].filter(Boolean),
        shorts_hook: opportunity.visualDemo >= 70 ? "이 장면 하나로 왜 인기인지 바로 보입니다." : "이 제품, 지금 사도 괜찮을까요?",
        caution: opportunity.risks.join(" "),
        analyzed_at: now,
        collected_at: now,
        raw_data: { sprint: 2, category: item.category || null, keyword: item.keyword || null, opportunity, input: item },
      };
    });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("trend_products")
      .upsert(rows, { onConflict: "source_name,affiliate_url" })
      .select("*");
    if (error) throw error;

    await supabase.from("product_intelligence_runs").insert({
      run_type: "collector",
      source_name: sourceName,
      item_count: data?.length || 0,
      status: "completed",
      details: { requested: items.length },
    });

    return NextResponse.json({ success: true, inserted: data?.length || 0, items: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "상품 후보 수집에 실패했습니다." }, { status: 500 });
  }
}
