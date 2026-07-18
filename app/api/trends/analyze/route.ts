import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeProduct } from "@/lib/ai/analyze-product";
import { extractProductFromUrl } from "@/lib/products/url-extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  product_url?: string;
  title?: string;
  description?: string;
  image_url?: string;
  affiliate_url?: string;
  platform?: string;
  price_text?: string;
  brand?: string;
  category?: string;
};

function text(value: unknown) {
  return String(value || "").trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const productUrl = text(body.product_url || body.affiliate_url);
    let extracted = null;
    let extractionWarning = "";

    if (productUrl) {
      try {
        extracted = await extractProductFromUrl(productUrl);
      } catch (error) {
        extractionWarning = error instanceof Error ? error.message : "상품 페이지 자동 추출에 실패했습니다.";
      }
    }

    const title = text(body.title) || extracted?.title || "";
    const affiliateUrl = text(body.affiliate_url) || extracted?.finalUrl || productUrl;
    const description = text(body.description) || extracted?.description || "";
    const imageUrl = text(body.image_url) || extracted?.imageUrl || "";
    const priceText = text(body.price_text) || extracted?.priceText || "";
    const platform = text(body.platform) || extracted?.platform || "etc";
    const brand = text(body.brand) || extracted?.brand || "";
    const category = text(body.category) || extracted?.category || "";

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          needsManualInput: true,
          message: extractionWarning || "상품명을 확인할 수 없습니다. 상품명을 직접 입력해주세요.",
          extracted,
        },
        { status: 422 },
      );
    }
    if (!affiliateUrl) {
      return NextResponse.json({ success: false, message: "상품 또는 제휴 링크를 입력해주세요." }, { status: 400 });
    }

    const analysis = await analyzeProduct({
      title,
      description,
      platform,
      priceText,
      brand,
      category,
      sourceUrl: affiliateUrl,
    });

    const now = new Date().toISOString();
    const row = {
      title,
      description,
      image_url: imageUrl,
      affiliate_url: affiliateUrl,
      platform,
      price_text: priceText,
      source_name: productUrl ? "ai_url" : "ai_manual",
      external_rank: 0,
      external_score: analysis.score,
      trend_score: analysis.score,
      status: "analyzed",
      ai_score: analysis.score,
      ai_summary: analysis.summary,
      target_audience: analysis.targetAudience,
      selling_points: analysis.sellingPoints,
      seo_keywords: analysis.seoKeywords,
      shorts_hook: analysis.shortsHook,
      caution: analysis.caution,
      analyzed_at: now,
      collected_at: now,
      raw_data: {
        request: body,
        extraction: extracted,
        extractionWarning,
        analysis,
        brand,
        category,
      },
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("trend_products")
      .upsert(row, { onConflict: "source_name,affiliate_url" })
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, item: data, extracted, analysis, extractionWarning });
  } catch (error) {
    console.error("AI 상품 분석 오류:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "AI 상품 분석에 실패했습니다." },
      { status: 500 },
    );
  }
}
