import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateProfit } from "@/lib/shorts-intelligence-v3/scoring";
import type { ProfitEstimateInput } from "@/lib/shorts-intelligence-v3/types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as ProfitEstimateInput;
    if (!body.affiliatePlatform) {
      return NextResponse.json({ success: false, message: "제휴 플랫폼을 입력해주세요." }, { status: 400 });
    }
    const estimate = estimateProfit(body);
    const status = body.commissionVerified ? "verified" : "draft";
    const payload = {
      product_id: body.productId || null,
      discovery_run_id: body.discoveryRunId || null,
      affiliate_platform: String(body.affiliatePlatform),
      campaign_name: body.campaignName || null,
      commission_rate: Number(body.commissionRate) || 0,
      commission_verified: Boolean(body.commissionVerified),
      commission_source: body.commissionSource || null,
      commission_verified_at: body.commissionVerified ? new Date().toISOString() : null,
      average_order_value: Number(body.averageOrderValue) || 0,
      expected_clicks: Math.max(0, Math.round(Number(body.expectedClicks) || 0)),
      expected_conversion_rate: Number(body.expectedConversionRate) || 0,
      expected_orders: estimate.expectedOrders,
      expected_return_rate: Number(body.expectedReturnRate) || 0,
      estimated_content_cost: Number(body.estimatedContentCost) || 0,
      estimated_ad_cost: Number(body.estimatedAdCost) || 0,
      expected_gross_commission: estimate.expectedGrossCommission,
      expected_refund_loss: estimate.expectedRefundLoss,
      expected_net_profit: estimate.expectedNetProfit,
      high_commission_eligible: estimate.highCommissionEligible,
      profit_score: estimate.profitScore,
      risk_score: estimate.riskScore,
      status,
      assumptions: {
        warning: body.commissionVerified ? null : "수수료율이 검증되지 않아 30% 이상 상품관에는 포함되지 않습니다.",
      },
    };
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("affiliate_profit_opportunities").insert(payload).select("*").single();
    if (error) throw error;
    if (body.productId) {
      await supabase.from("products").update({
        commission_rate: payload.commission_rate,
        commission_verified: payload.commission_verified,
        commission_verified_at: payload.commission_verified_at,
        commission_source: payload.commission_source,
        expected_net_profit: payload.expected_net_profit,
        profit_score: payload.profit_score,
      }).eq("id", body.productId);
    }
    return NextResponse.json({ success: true, estimate, opportunity: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "예상 순이익을 계산하지 못했습니다." }, { status: 500 });
  }
}
