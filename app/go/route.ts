import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.redirect(new URL("/products", request.url));
  }

  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !product) {
    return NextResponse.redirect(new URL("/products", request.url));
  }

  await supabase.from("product_clicks").insert({
    product_id: id,
  });

  return NextResponse.redirect(product.affiliate_url);
}