import { NextResponse } from "next/server";
import { CoupangPartnersError, testCoupangConnection } from "@/lib/affiliate/coupang";
import { createAffiliateProof } from "@/lib/affiliate/verification-proof";
import { CONNECTION_COOKIE_OPTIONS } from "@/lib/connections/secure-cookie";

export const runtime = "nodejs";

export async function POST() {
  const accessKey = process.env.COUPANG_ACCESS_KEY?.trim();
  const secretKey = process.env.COUPANG_SECRET_KEY?.trim();
  if (!accessKey || !secretKey) {
    return NextResponse.json(
      { success: false, message: "COUPANG_ACCESS_KEY와 COUPANG_SECRET_KEY를 먼저 등록하세요." },
      { status: 400 },
    );
  }

  try {
    const sample = await testCoupangConnection();
    const response = NextResponse.json({
      success: true,
      message: `쿠팡 API 서명·권한·상품 링크를 실제 확인했습니다. 샘플: ${sample.title}`,
      sample: { title: sample.title, priceText: sample.priceText, affiliateUrl: sample.affiliateUrl },
    });
    response.cookies.set(
      "gy_coupang_verified",
      createAffiliateProof("coupang", `${accessKey}:${secretKey}`, "api"),
      { ...CONNECTION_COOKIE_OPTIONS, maxAge: 60 * 60 * 24 },
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "쿠팡 API 연결에 실패했습니다.";
    return NextResponse.json(
      { success: false, message, code: error instanceof CoupangPartnersError ? error.code : "COUPANG_TEST_FAILED" },
      { status: error instanceof CoupangPartnersError ? error.status : 502 },
    );
  }
}
