import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Decision = "approved" | "held" | "rejected";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; decision?: Decision };
    const id = String(body.id || "").trim();
    const decision = body.decision;
    if (!id || !decision || !["approved", "held", "rejected"].includes(decision)) {
      return NextResponse.json({ success: false, message: "상품과 처리 상태를 확인해주세요." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: item, error: readError } = await supabase.from("trend_products").select("*").eq("id", id).single();
    if (readError) throw readError;

    let productId = item.product_id as string | null;
    if (decision === "approved" && !productId) {
      const { data: existing } = await supabase.from("products").select("id").eq("affiliate_url", item.affiliate_url).maybeSingle();
      productId = existing?.id || null;
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
    }

    const { error: updateError } = await supabase.from("trend_products").update({
      status: decision,
      product_id: decision === "approved" ? productId : item.product_id,
      decision_at: new Date().toISOString(),
    }).eq("id", id);
    if (updateError) throw updateError;

    await supabase.from("product_intelligence_runs").insert({
      run_type: "decision",
      source_name: item.source_name,
      item_count: 1,
      status: "completed",
      details: { trendProductId: id, decision, productId },
    });

    return NextResponse.json({ success: true, decision, productId });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "상품 처리에 실패했습니다." }, { status: 500 });
  }
}
