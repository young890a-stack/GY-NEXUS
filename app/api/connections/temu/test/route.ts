import { NextResponse } from "next/server";

export async function POST() {
  const affiliateId = process.env.TEMU_AFFILIATE_ID?.trim();
  const template = process.env.TEMU_AFFILIATE_LINK_TEMPLATE?.trim();

  if (!affiliateId || !template) {
    return NextResponse.json(
      {
        success: false,
        message: "TEMU_AFFILIATE_ID와 TEMU_AFFILIATE_LINK_TEMPLATE을 등록하세요.",
      },
      { status: 400 },
    );
  }

  if (!template.includes("{url}") && !template.includes("{product_url}")) {
    return NextResponse.json(
      {
        success: false,
        message: "링크 템플릿에는 {url} 또는 {product_url} 자리표시자가 있어야 합니다.",
      },
      { status: 400 },
    );
  }

  const sampleUrl = "https://www.temu.com/";
  const generated = template
    .replaceAll("{affiliate_id}", encodeURIComponent(affiliateId))
    .replaceAll("{url}", encodeURIComponent(sampleUrl))
    .replaceAll("{product_url}", encodeURIComponent(sampleUrl));

  try {
    const parsed = new URL(generated);
    const success = NextResponse.json({
      success: true,
      message: "Temu 제휴 링크 템플릿 검증이 완료되었습니다.",
      sampleUrl: parsed.toString(),
      mode: "affiliate-link",
    });
    success.cookies.set("gy_temu_verified", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
    return success;
  } catch {
    return NextResponse.json(
      { success: false, message: "생성된 Temu 링크 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }
}
