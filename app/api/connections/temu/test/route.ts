import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAffiliateProof } from "@/lib/affiliate/verification-proof";
import { CONNECTION_COOKIE_OPTIONS } from "@/lib/connections/secure-cookie";

export async function POST() {
  try {
    const supabase = createAdminClient();
    const [{ count: candidateCount, error: candidateError }, { count: productCount, error: productError }] = await Promise.all([
      supabase.from("trend_products").select("id", { count: "exact", head: true }).eq("platform", "temu"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("platform", "temu"),
    ]);
    if (candidateError) throw candidateError;
    if (productError) throw productError;
    const storedCount = (candidateCount || 0) + (productCount || 0);
    if (!storedCount) {
      return NextResponse.json(
        {
          success: false,
          message: "Temu는 공개 제휴 API 연결이 아니라 공유 링크 방식입니다. 상품 소싱센터에서 Temu 공유 링크를 1개 이상 등록해주세요.",
          mode: "share-link",
        },
        { status: 400 },
      );
    }

    const credential = process.env.TEMU_AFFILIATE_ID?.trim() || "stored-temu-share-links";
    const response = NextResponse.json({
      success: true,
      message: `Temu 공유 링크 운영 준비가 완료되었습니다. 저장된 후보·정식 상품 ${storedCount}개를 확인했습니다.`,
      mode: "share-link",
      storedCount,
    });
    response.cookies.set(
      "gy_temu_verified",
      createAffiliateProof("temu", credential, "share-link"),
      { ...CONNECTION_COOKIE_OPTIONS, maxAge: 60 * 60 * 24 },
    );
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Temu 링크 운영 상태 확인에 실패했습니다." },
      { status: 500 },
    );
  }
}
