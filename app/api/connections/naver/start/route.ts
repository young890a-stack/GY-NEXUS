import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  connectionResultUrl,
  getNaverCredentials,
  getOAuthRedirectUri,
} from "@/lib/connections/oauth-config";

export async function GET(request: NextRequest) {
  const credentials = getNaverCredentials();
  if (!credentials) {
    return NextResponse.redirect(connectionResultUrl(request, "naver", "error", "config"));
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = getOAuthRedirectUri("naver", request);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: credentials.clientId,
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
