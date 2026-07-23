import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function clean(value: string | null, max: number) {
  return String(value || "").replace(/[^\p{L}\p{N}._:-]/gu, "").slice(0, max) || null;
}

export async function GET(request: NextRequest) {
  const fallback = new URL("/products", request.url);
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.redirect(fallback);
    const supabase = createAdminClient();
    const { data: product, error } = await supabase.from("products").select("id,affiliate_url").eq("id", id).single();
    if (error || !product?.affiliate_url) return NextResponse.redirect(fallback);

    const detailed = {
      product_id: id,
      content_key: clean(request.nextUrl.searchParams.get("content"), 100),
      channel: clean(request.nextUrl.searchParams.get("channel"), 30),
      video_id: clean(request.nextUrl.searchParams.get("video"), 100),
      referrer: request.headers.get("referer")?.slice(0, 1000) || null,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
    };
    const { error: clickError } = await supabase.from("product_clicks").insert(detailed);
    if (clickError) {
      const { error: legacyError } = await supabase.from("product_clicks").insert({ product_id: id });
      if (legacyError) console.error("클릭 기록 실패:", legacyError.message);
    }
    return NextResponse.redirect(product.affiliate_url);
  } catch (error) {
    console.error("제휴 링크 이동 실패:", error);
    return NextResponse.redirect(fallback);
  }
}
