import { NextResponse } from "next/server";
import { AuthorizationError, requireOwner } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const n = (value: unknown) => Math.max(0, Number(value) || 0);
const rate = (value: unknown) => Math.max(0, Math.min(100, n(value)));

function performanceScore(body: Record<string, unknown>) {
  const views = n(body.views);
  const impressions = n(body.impressions);
  const clicks = n(body.clicks);
  const orders = n(body.orders);
  const saves = n(body.saves);
  const shares = n(body.shares);
  const clickRate = impressions ? clicks / impressions * 100 : views ? clicks / views * 100 : 0;
  const conversionRate = clicks ? orders / clicks * 100 : 0;
  const engagementRate = views ? (saves + shares) / views * 100 : 0;
  return Math.min(100, Number((
    rate(body.firstThreeSecondRate) * 0.2
    + rate(body.averageViewPercent) * 0.22
    + rate(body.completionRate) * 0.18
    + Math.min(100, clickRate * 12) * 0.18
    + Math.min(100, conversionRate * 10) * 0.14
    + Math.min(100, engagementRate * 20) * 0.08
  ).toFixed(2)));
}

function failure(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }
  return NextResponse.json({
    success: false,
    message: error instanceof Error ? error.message : "성과 데이터를 저장하지 못했습니다.",
  }, { status: 500 });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    const { id: runId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const variantId = String(body.variantId || "");
    const channel = ["youtube", "instagram", "manual"].includes(String(body.channel)) ? String(body.channel) : "manual";
    if (!variantId) return NextResponse.json({ success: false, message: "성과를 연결할 영상 버전을 선택해주세요." }, { status: 400 });
    const supabase = createAdminClient();
    const { data: variant, error: variantError } = await supabase
      .from("shopping_shorts_variants")
      .select("id,run_id,hook_style,duration_seconds")
      .eq("id", variantId)
      .eq("run_id", runId)
      .single();
    if (variantError || !variant) throw variantError || new Error("선택한 영상 버전을 찾지 못했습니다.");
    const score = performanceScore(body);
    const metricRow = {
      variant_id: variantId,
      channel,
      external_content_id: String(body.externalContentId || "") || null,
      views: Math.round(n(body.views)),
      impressions: Math.round(n(body.impressions)),
      first_three_second_rate: rate(body.firstThreeSecondRate),
      average_view_percent: rate(body.averageViewPercent),
      completion_rate: rate(body.completionRate),
      saves: Math.round(n(body.saves)),
      shares: Math.round(n(body.shares)),
      clicks: Math.round(n(body.clicks)),
      orders: Math.round(n(body.orders)),
      revenue: n(body.revenue),
      ad_spend: n(body.adSpend),
      performance_score: score,
      measured_at: String(body.measuredAt || new Date().toISOString()),
      updated_at: new Date().toISOString(),
    };
    const { error: metricError } = await supabase
      .from("shopping_shorts_metrics")
      .upsert(metricRow, { onConflict: "variant_id,channel" });
    if (metricError) throw metricError;

    const { data: matchingVariants, error: matchingError } = await supabase
      .from("shopping_shorts_variants")
      .select("id")
      .eq("hook_style", variant.hook_style)
      .eq("duration_seconds", variant.duration_seconds);
    if (matchingError) throw matchingError;
    const ids = (matchingVariants || []).map((row) => row.id);
    const { data: metrics, error: metricsError } = ids.length
      ? await supabase.from("shopping_shorts_metrics").select("performance_score,first_three_second_rate,average_view_percent,clicks,orders").in("variant_id", ids)
      : { data: [], error: null };
    if (metricsError) throw metricsError;
    const rows = metrics || [];
    const average = rows.length ? rows.reduce((sum, row) => sum + n(row.performance_score), 0) / rows.length : score;
    const patternKey = `${variant.hook_style}:${variant.duration_seconds}`;
    const active = rows.length >= Math.max(3, Number(process.env.SHORTS_LEARNING_MIN_SAMPLE) || 5);
    const { error: patternError } = await supabase.from("shopping_shorts_patterns").upsert({
      pattern_key: patternKey,
      hook_style: String(variant.hook_style),
      recommendation: average >= 65
        ? `${variant.duration_seconds}초 구성을 다음 상품에서도 우선 테스트`
        : `${variant.duration_seconds}초 구성은 훅과 증거 장면을 크게 변경해 재시험`,
      score: Number(average.toFixed(2)),
      sample_size: rows.length,
      evidence: {
        latestScore: score,
        averageFirstThreeSeconds: rows.length ? rows.reduce((sum, row) => sum + n(row.first_three_second_rate), 0) / rows.length : 0,
        averageViewPercent: rows.length ? rows.reduce((sum, row) => sum + n(row.average_view_percent), 0) / rows.length : 0,
      },
      active,
      updated_at: new Date().toISOString(),
    }, { onConflict: "pattern_key" });
    if (patternError) throw patternError;
    return NextResponse.json({
      success: true,
      performanceScore: score,
      patternActive: active,
      sampleSize: rows.length,
      message: active
        ? "성과가 저장되었고 다음 쇼츠 제작에 학습 규칙으로 반영됩니다."
        : `성과가 저장되었습니다. 같은 패턴 표본 ${Math.max(3, Number(process.env.SHORTS_LEARNING_MIN_SAMPLE) || 5)}개부터 자동 학습에 반영됩니다.`,
    });
  } catch (error) {
    return failure(error);
  }
}

