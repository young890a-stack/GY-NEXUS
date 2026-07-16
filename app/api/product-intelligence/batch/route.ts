import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateOpportunity } from "@/lib/product-intelligence/opportunity";

type Candidate = {
  title?: string;
  platform?: string;
  affiliate_url?: string;
  description?: string;
  image_url?: string;
  price_text?: string;
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
    const body = await request.json() as { candidates?: Candidate[] };
    const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 100) : [];
    if (!candidates.length) return NextResponse.json({ success: false, message: "상품 후보가 없습니다." }, { status: 400 });

    const now = new Date().toISOString();
    const rows = candidates.map((candidate, index) => {
      const title = String(candidate.title || "").trim();
      const affiliateUrl = String(candidate.affiliate_url || "").trim();
      if (!title || !affiliateUrl) throw new Error(`${index + 1}번째 상품의 상품명 또는 제휴 링크가 비어 있습니다.`);
      const opportunity = calculateOpportunity(candidate);
      return {
        title,
        description: String(candidate.description || "").trim(),
        image_url: String(candidate.image_url || "").trim() || null,
        affiliate_url: affiliateUrl,
        platform: String(candidate.platform || "etc").trim().toLowerCase(),
        price_text: String(candidate.price_text || "").trim(),
        source_name: "sprint2_batch",
        external_rank: index + 1,
        external_score: opportunity.score,
        trend_score: opportunity.score,
        status: "analyzed",
        ai_score: opportunity.score,
        ai_summary: `${opportunity.grade}등급 · ${opportunity.recommendation}. ${opportunity.reasons.join(" ")}`,
        target_audience: "20~40대 실용 소비자",
        selling_points: opportunity.reasons,
        seo_keywords: [],
        shorts_hook: opportunity.visualDemo >= 70 ? "이 장면 하나로 왜 인기인지 바로 보입니다." : "이 제품, 지금 사도 괜찮을까요?",
        caution: opportunity.risks.join(" "),
        analyzed_at: now,
        collected_at: now,
        raw_data: { sprint: 2, opportunity, input: candidate },
      };
    });

    const supabase = await createClient();
    const { data, error } = await supabase.from("trend_products").upsert(rows, { onConflict: "source_name,affiliate_url" }).select("*");
    if (error) throw error;
    return NextResponse.json({ success: true, inserted: data?.length || 0, items: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "상품 후보 분석에 실패했습니다." }, { status: 500 });
  }
}
