import crypto from "node:crypto";
import { NextResponse } from "next/server";

function formatSignedDate(date: Date) {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

export async function POST() {
  const accessKey = process.env.COUPANG_ACCESS_KEY?.trim();
  const secretKey = process.env.COUPANG_SECRET_KEY?.trim();
  if (!accessKey || !secretKey) {
    return NextResponse.json(
      { success: false, message: "COUPANG_ACCESS_KEY와 COUPANG_SECRET_KEY를 먼저 등록하세요." },
      { status: 400 },
    );
  }

  const method = "GET";
  const path =
    process.env.COUPANG_TEST_PATH?.trim() ||
    "/v2/providers/affiliate_open_api/apis/openapi/products/search";
  const query = "keyword=notebook&limit=1";
  const signedDate = formatSignedDate(new Date());
  const message = `${signedDate}${method}${path}${query}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("hex");
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;

  try {
    const response = await fetch(`https://api-gateway.coupang.com${path}?${query}`, {
      method,
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      cache: "no-store",
    });
    const text = await response.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: `쿠팡 API가 ${response.status} 상태를 반환했습니다. 파트너스 포털의 API 권한과 키를 확인하세요.`,
          response: data,
        },
        { status: 502 },
      );
    }

    const success = NextResponse.json({
      success: true,
      message: "쿠팡 파트너스 API 서명 인증과 상품 검색 요청이 성공했습니다.",
      sample: data,
    });
    success.cookies.set("gy_coupang_verified", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
    return success;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "쿠팡 API 연결에 실패했습니다.",
      },
      { status: 502 },
    );
  }
}
