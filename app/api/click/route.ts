import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("id");

  if (!productId) {
    return NextResponse.redirect(new URL("/products", request.url));
  }

  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("affiliate_url")
    .eq("id", productId)
    .single();

  if (!product?.affiliate_url) {
    return NextResponse.redirect(new URL("/products", request.url));
  }

  await supabase.from("product_clicks").insert({
    product_id: productId,
  });

  return NextResponse.redirect(product.affiliate_url);
}