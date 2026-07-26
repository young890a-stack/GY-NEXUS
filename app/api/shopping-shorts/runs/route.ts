import { NextResponse } from "next/server";
import { AuthorizationError, requireOwner } from "@/lib/auth/require-owner";
import { generateShoppingShorts } from "@/lib/shopping-shorts/generate";
import { resolveShoppingProduct } from "@/lib/shopping-shorts/product-source";
import type { LearnedPattern, ShoppingShortsProductInput } from "@/lib/shopping-shorts/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function profitEstimate(product: ShoppingShortsProductInput) {
  const sellingPrice = Math.max(0, number(product.sellingPrice));
  const supplyPrice = Math.max(0, number(product.supplyPrice));
  const shippingCost = Math.max(0, number(product.shippingCost));
  const platformFeeRate = Math.max(0, Math.min(100, number(product.platformFeeRate)));
  const adCostPerOrder = Math.max(0, number(product.adCostPerOrder));
  const returnReserveRate = Math.max(0, Math.min(100, number(product.returnReserveRate)));
  if (!sellingPrice) return { ready: false };
  const platformFee = sellingPrice * platformFeeRate / 100;
  const returnReserve = sellingPrice * returnReserveRate / 100;
  const netProfit = sellingPrice - supplyPrice - shippingCost - platformFee - adCostPerOrder - returnReserve;
  const netMarginRate = sellingPrice ? netProfit / sellingPrice * 100 : 0;
  return {
    ready: true,
    sellingPrice,
    supplyPrice,
    shippingCost,
    platformFeeRate,
    platformFee: Math.round(platformFee),
    adCostPerOrder,
    returnReserveRate,
    returnReserve: Math.round(returnReserve),
    netProfit: Math.round(netProfit),
    netMarginRate: Number(netMarginRate.toFixed(2)),
    commerceEligible: netProfit > 0 && netMarginRate >= 15,
  };
}

function failure(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "자동 쇼츠 제작을 시작하지 못했습니다.";
  const migrationMissing = /shopping_shorts_/i.test(message) && /(relation|schema cache|does not exist|찾을 수)/i.test(message);
  return NextResponse.json({
    success: false,
    message: migrationMissing
      ? "쇼츠 제작기 데이터베이스가 아직 준비되지 않았습니다. 제공된 20260726 마이그레이션 SQL을 먼저 실행해주세요."
      : message,
  }, { status: 500 });
}

export async function GET() {
  try {
    await requireOwner();
    const { data, error } = await createAdminClient()
      .from("shopping_shorts_runs")
      .select("id,product_name,product_image_url,status,quality_threshold,approved_variant_id,profit_estimate,created_at,updated_at,shopping_shorts_variants(id,quality_score,quality_status)")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return NextResponse.json({ success: true, runs: data || [] });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  let runId = "";
  try {
    const owner = await requireOwner();
    const body = await request.json() as {
      product?: ShoppingShortsProductInput;
      qualityThreshold?: number;
      maxRegenerations?: number;
    };
    const requestedProduct = body.product || {};
    const product = await resolveShoppingProduct(requestedProduct);
    const qualityThreshold = Math.max(80, Math.min(95, Math.round(number(
      body.qualityThreshold,
      number(process.env.SHORTS_LAB_QUALITY_THRESHOLD, 86),
    ))));
    const maxRegenerations = Math.max(1, Math.min(2, Math.round(number(
      body.maxRegenerations,
      number(process.env.SHORTS_LAB_MAX_REGENERATIONS, 2),
    ))));
    const supabase = createAdminClient();
    const profit = profitEstimate(product);

    const { data: run, error: runError } = await supabase.from("shopping_shorts_runs").insert({
      created_by: owner.id,
      product_url: product.url || null,
      product_name: product.name,
      product_description: product.description,
      product_image_url: product.imageUrl || null,
      price_text: product.priceText || null,
      input_snapshot: product,
      profit_estimate: profit,
      status: "generating",
      quality_threshold: qualityThreshold,
      max_regenerations: maxRegenerations,
    }).select("id").single();
    if (runError || !run) throw runError || new Error("제작 실행을 저장하지 못했습니다.");
    runId = run.id;

    const [{ data: patternRows }, { data: recentRows }] = await Promise.all([
      supabase
        .from("shopping_shorts_patterns")
        .select("pattern_key,hook_style,recommendation,score,sample_size")
        .eq("active", true)
        .order("score", { ascending: false })
        .limit(8),
      supabase
        .from("shopping_shorts_variants")
        .select("hook,script")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    const patterns: LearnedPattern[] = (patternRows || []).map((row) => ({
      patternKey: String(row.pattern_key),
      hookStyle: String(row.hook_style),
      recommendation: String(row.recommendation),
      score: number(row.score),
      sampleSize: number(row.sample_size),
    }));
    const generation = await generateShoppingShorts({
      product: {
        ...product,
        name: product.name,
        description: product.description,
        reviews: product.reviews || [],
      },
      threshold: qualityThreshold,
      maxRegenerations,
      learnedPatterns: patterns,
      recentVariantTexts: (recentRows || []).map((row) => `${row.hook || ""} ${row.script || ""}`),
    });

    const variantRows = generation.variants.map((variant) => ({
      run_id: runId,
      variant_key: variant.variantKey,
      hook_index: variant.hookIndex,
      hook_style: variant.hookStyle,
      duration_seconds: variant.duration,
      hook: variant.hook,
      title: variant.title,
      description: variant.description,
      hashtags: variant.hashtags,
      script: variant.script,
      cta: variant.cta,
      thumbnail: variant.thumbnail,
      scenes: variant.scenes,
      srt: variant.srt,
      plain_subtitles: variant.plainSubtitles,
      quality_report: variant.quality,
      quality_score: variant.quality.score,
      quality_status: variant.quality.approved ? "approved" : "blocked",
      regeneration_count: variant.regenerationCount,
      fingerprint: variant.fingerprint,
    }));
    const { data: savedVariants, error: variantsError } = await supabase
      .from("shopping_shorts_variants")
      .insert(variantRows)
      .select("id,variant_key,quality_score,quality_status");
    if (variantsError) throw variantsError;
    const approved = (savedVariants || []).filter((variant) => variant.quality_status === "approved");
    const topVariant = approved.sort((a, b) => number(b.quality_score) - number(a.quality_score))[0];
    const status = approved.length === generation.variants.length ? "ready" : approved.length ? "partial" : "failed";
    const { error: updateError } = await supabase.from("shopping_shorts_runs").update({
      product_analysis: generation.product,
      learned_patterns_used: generation.learnedPatternsUsed,
      status,
      approved_variant_id: topVariant?.id || null,
      error_message: approved.length ? null : "모든 버전이 품질 기준을 통과하지 못했습니다. 상품 정보를 보완해 다시 생성해주세요.",
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      runId,
      status,
      approvedCount: approved.length,
      totalCount: generation.variants.length,
      message: `9개 버전 생성과 품질 검수가 끝났습니다. ${approved.length}개가 자동 제작 기준을 통과했습니다.`,
    });
  } catch (error) {
    if (runId) {
      try {
        await createAdminClient().from("shopping_shorts_runs").update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "생성 실패",
          updated_at: new Date().toISOString(),
        }).eq("id", runId);
      } catch {
        // Preserve the original generation error.
      }
    }
    return failure(error);
  }
}
