import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const fallback = new URL("/products", request.url);
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.redirect(fallback);
    const supabase = await createClient();
    const { data: product, error } = await supabase.from("products").select("id,affiliate_url").eq("id", id).single();
    if (error || !product?.affiliate_url) return NextResponse.redirect(fallback);
    const { error: clickError } = await supabase.from("product_clicks").insert({ product_id: id });
    if (clickError) console.error("클릭 기록 실패:", clickError.message);
    return NextResponse.redirect(product.affiliate_url);
  } catch (error) {
    console.error("제휴 링크 이동 실패:", error);
    return NextResponse.redirect(fallback);
  }
}
