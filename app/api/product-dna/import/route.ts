import { NextResponse } from "next/server";
import { createManualFallback, extractProductSource } from "@/lib/product-dna/metadata";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { url, manual } = await request.json() as { url?: string; manual?: boolean };
    if (!url?.trim()) return NextResponse.json({ success: false, message: "제휴링크를 입력해주세요." }, { status: 400 });
    const product = manual
      ? createManualFallback(url, "사용자가 직접 입력 모드를 선택했습니다.")
      : await extractProductSource(url);
    return NextResponse.json({
      success: true,
      product,
      needsManualInput: product.extractionStatus === "manual",
      message: product.blockedReason || "상품 정보를 확인했습니다.",
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "상품 정보를 가져오지 못했습니다." }, { status: 400 });
  }
}
