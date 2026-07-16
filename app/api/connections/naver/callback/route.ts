import { NextRequest, NextResponse } from "next/server";
import { CONNECTION_COOKIE_OPTIONS, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("gy_naver_state")?.value;
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();

  if (!code || !state || !expectedState || state !== expectedState || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/admin/connections?error=naver_callback", request.url));
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    state,
  });
  const tokenResponse = await fetch(`https://nid.naver.com/oauth2.0/token?${params}`, {
    cache: "no-store",
  });
  const token = (await tokenResponse.json()) as Omit<OAuthToken, "created_at"> & {
    error?: string;
  };

  if (!tokenResponse.ok || token.error || !token.access_token) {
    return NextResponse.redirect(new URL("/admin/connections?error=naver_token", request.url));
  }

  const response = NextResponse.redirect(new URL("/admin/connections?connected=naver", request.url));
  response.cookies.set(
    "gy_naver_token",
    encryptConnectionValue({ ...token, created_at: Date.now() }),
    CONNECTION_COOKIE_OPTIONS,
  );
  response.cookies.delete("gy_naver_state");
  return response;
}
