import { NextRequest, NextResponse } from "next/server";
import { connectionResultUrl, getNaverCredentials } from "@/lib/connections/oauth-config";
import { CONNECTION_COOKIE_OPTIONS, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";

export async function GET(request: NextRequest) {
  const fail = (reason: string) => {
    const response = NextResponse.redirect(connectionResultUrl(request, "naver", "error", reason));
    response.cookies.delete("gy_naver_state");
    return response;
  };
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) return fail(providerError === "access_denied" ? "denied" : "provider");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("gy_naver_state")?.value;
  const credentials = getNaverCredentials();
  if (!credentials) return fail("config");
  if (!code || !state || !expectedState || state !== expectedState) return fail("state");

  let token: Omit<OAuthToken, "created_at"> & { error?: string };
  try {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      state,
    });
    const tokenResponse = await fetch(`https://nid.naver.com/oauth2.0/token?${params}`, {
      cache: "no-store",
    });
    token = (await tokenResponse.json()) as Omit<OAuthToken, "created_at"> & { error?: string };
    if (!tokenResponse.ok || token.error || !token.access_token) return fail("token");
  } catch (error) {
    console.error("Naver OAuth token exchange failed", error);
    return fail("network");
  }

  try {
    const response = NextResponse.redirect(connectionResultUrl(request, "naver", "connected"));
    response.cookies.set("gy_naver_token", encryptConnectionValue({ ...token, created_at: Date.now() }), CONNECTION_COOKIE_OPTIONS);
    response.cookies.delete("gy_naver_state");
    return response;
  } catch (error) {
    console.error("Naver OAuth token storage failed", error);
    return fail("storage");
  }
}
