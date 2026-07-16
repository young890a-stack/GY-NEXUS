import { NextRequest, NextResponse } from "next/server";
import { CONNECTION_COOKIE_OPTIONS, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("gy_blogger_state")?.value;
  const clientId = (process.env.BLOGGER_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID)?.trim();
  const clientSecret = (process.env.BLOGGER_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET)?.trim();

  if (!code || !state || !expectedState || state !== expectedState || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/admin/connections?error=blogger_callback", request.url));
  }

  const redirectUri = `${request.nextUrl.origin}/api/connections/blogger/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/admin/connections?error=blogger_token", request.url));
  }

  const token = (await tokenResponse.json()) as Omit<OAuthToken, "created_at">;
  const response = NextResponse.redirect(new URL("/admin/connections?connected=blogger", request.url));
  response.cookies.set("gy_blogger_token", encryptConnectionValue({ ...token, created_at: Date.now() }), CONNECTION_COOKIE_OPTIONS);
  response.cookies.delete("gy_blogger_state");
  return response;
}
