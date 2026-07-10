import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get("id");

    if (!productId) {
      return NextResponse.redirect(
        new URL("/admin/products", request.url)
      );
    }

    const supabase = await createClient();

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, affiliate_url")
      .eq("id", productId)
      .single();

    if (productError || !product?.affiliate_url) {
      console.error("상품 조회 실패:", productError);

      return NextResponse.redirect(
        new URL("/admin/products", request.url)
      );
    }

    const { error: clickError } = await supabase
      .from("product_clicks")
      .insert({
        product_id: productId,
      });

    if (clickError) {
      console.error("클릭 저장 실패:", clickError);

      return NextResponse.json(
        {
          success: false,
          message: "클릭 저장에 실패했습니다.",
          error: clickError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.redirect(product.affiliate_url);
  } catch (error) {
    console.error("클릭 API 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message: "클릭 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}