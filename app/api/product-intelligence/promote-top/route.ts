import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { minimumScore?: number; limit?: number };
    const minimumScore = Math.max(0, Math.min(100, Number(body.minimumScore ?? 75)));
    const limit = Math.max(1, Math.min(30, Number(body.limit ?? 10)));
    const supabase = await createClient();
    const { data: candidates, error } = await supabase
      .from("trend_products")
      .select("*")
      .gte("ai_score", minimumScore)
      .neq("status", "approved")
      .order("ai_score", { ascending: false })
      .limit(limit);
    if (error) throw error;

    let promoted = 0;
    for (const item of candidates || []) {
      let productId = item.product_id as string | null;
      if (!productId) {
        const { data: product, error: insertError } = await supabase.from("products").insert({
          title: item.title,
          description: item.description,
          image_url: item.image_url || null,
          affiliate_url: item.affiliate_url,
          platform: item.platform,
          price_text: item.price_text || null,
        }).select("id").single();
        if (insertError) throw insertError;
        productId = product.id;
      }
      const { error: updateError } = await supabase.from("trend_products").update({ product_id: productId, status: "approved" }).eq("id", item.id);
      if (updateError) throw updateError;
      promoted += 1;
    }

    await supabase.from("product_intelligence_runs").insert({
      run_type: "promote_top",
      source_name: "stored_candidates",
      item_count: promoted,
      status: "completed",
      details: { minimumScore, limit },
    });
    return NextResponse.json({ success: true, promoted });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "TOP 상품 등록에 실패했습니다." }, { status: 500 });
  }
}
