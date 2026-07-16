import { NextRequest, NextResponse } from "next/server";
import { CONNECTION_COOKIE_OPTIONS, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("gy_youtube_state")?.value;
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();

  if (!code || !state || !expectedState || state !== expectedState || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/admin/connections?error=youtube_callback", request.url));
  }

  const redirectUri = `${request.nextUrl.origin}/api/connections/youtube/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/admin/connections?error=youtube_token", request.url));
  }

  const token = (await tokenResponse.json()) as Omit<OAuthToken, "created_at">;
  const response = NextResponse.redirect(new URL("/admin/connections?connected=youtube", request.url));
  response.cookies.set(
    "gy_youtube_token",
    encryptConnectionValue({ ...token, created_at: Date.now() }),
    CONNECTION_COOKIE_OPTIONS,
  );
  response.cookies.delete("gy_youtube_state");
  return response;
}
