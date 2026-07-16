import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SEARCH_CONSOLE_SCOPE } from "@/lib/search-console/client";
import { GA4_SCOPE } from "@/lib/analytics/ga4";

export async function GET(request: NextRequest) {
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.SEARCH_CONSOLE_CLIENT_ID ||
    process.env.BLOGGER_CLIENT_ID ||
    process.env.YOUTUBE_CLIENT_ID
  )?.trim();
  if (!clientId) return NextResponse.redirect(new URL("/admin/growth?error=google_config", request.url));

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${request.nextUrl.origin}/api/search-console/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    scope: ["openid", "email", "profile", SEARCH_CONSOLE_SCOPE, GA4_SCOPE].join(" "),
    state,
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set("gy_gsc_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
