import { NextRequest, NextResponse } from "next/server";
import { CONNECTION_COOKIE_OPTIONS, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("gy_gsc_state")?.value;
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.SEARCH_CONSOLE_CLIENT_ID ||
    process.env.BLOGGER_CLIENT_ID ||
    process.env.YOUTUBE_CLIENT_ID
  )?.trim();
  const clientSecret = (
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.SEARCH_CONSOLE_CLIENT_SECRET ||
    process.env.BLOGGER_CLIENT_SECRET ||
    process.env.YOUTUBE_CLIENT_SECRET
  )?.trim();

  if (!code || !state || !expected || state !== expected || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/admin/growth?error=google_callback", request.url));
  }

  const redirectUri = `${request.nextUrl.origin}/api/search-console/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text();
    console.error("Google OAuth token exchange failed", detail);
    const url = new URL("/admin/growth", request.url);
    url.searchParams.set("error", "google_token");
    url.searchParams.set("detail", detail.slice(0, 180));
    return NextResponse.redirect(url);
  }

  try {
    const token = (await tokenResponse.json()) as Omit<OAuthToken, "created_at">;
    const encrypted = encryptConnectionValue({ ...token, created_at: Date.now() });
    const response = NextResponse.redirect(new URL("/admin/growth?connected=google", request.url));
    response.cookies.set("gy_google_token", encrypted, CONNECTION_COOKIE_OPTIONS);
    response.cookies.set("gy_gsc_token", encrypted, CONNECTION_COOKIE_OPTIONS);
    response.cookies.delete("gy_gsc_state");
    return response;
  } catch (error) {
    console.error("Google OAuth token storage failed", error);
    return NextResponse.redirect(new URL("/admin/growth?error=google_storage", request.url));
  }
}
