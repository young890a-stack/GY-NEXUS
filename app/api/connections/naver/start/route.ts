import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.redirect(new URL("/admin/connections?error=naver_config", request.url));
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${request.nextUrl.origin}/api/connections/naver/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });

  const response = NextResponse.redirect(`https://nid.naver.com/oauth2.0/authorize?${params}`);
  response.cookies.set("gy_naver_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
