import { NextRequest, NextResponse } from "next/server";
import { connectionResultUrl, getGoogleCredentials, getOAuthRedirectUri } from "@/lib/connections/oauth-config";
import { CONNECTION_COOKIE_OPTIONS, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";

export async function GET(request: NextRequest) {
  const fail = (reason: string) => {
    const response = NextResponse.redirect(connectionResultUrl(request, "blogger", "error", reason));
    response.cookies.delete("gy_blogger_state");
    return response;
  };
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) return fail(providerError === "access_denied" ? "denied" : "provider");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("gy_blogger_state")?.value;
  const credentials = getGoogleCredentials("blogger");
  if (!credentials) return fail("config");
  if (!code || !state || !expectedState || state !== expectedState) return fail("state");

  let token: Omit<OAuthToken, "created_at">;
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: getOAuthRedirectUri("blogger", request),
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) return fail("token");
    token = (await tokenResponse.json()) as Omit<OAuthToken, "created_at">;
    if (!token.access_token) return fail("token");
  } catch (error) {
    console.error("Blogger OAuth token exchange failed", error);
    return fail("network");
  }

  try {
    const response = NextResponse.redirect(connectionResultUrl(request, "blogger", "connected"));
    response.cookies.set("gy_blogger_token", encryptConnectionValue({ ...token, created_at: Date.now() }), CONNECTION_COOKIE_OPTIONS);
    response.cookies.delete("gy_blogger_state");
    return response;
  } catch (error) {
    console.error("Blogger OAuth token storage failed", error);
    return fail("storage");
  }
}
