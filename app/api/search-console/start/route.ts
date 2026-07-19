import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GA4_SCOPE } from "@/lib/analytics/ga4";
import {
  connectionResultUrl,
  getGoogleCredentials,
  getOAuthRedirectUri,
} from "@/lib/connections/oauth-config";
import { SEARCH_CONSOLE_SCOPE } from "@/lib/search-console/client";

export async function GET(request: NextRequest) {
  const credentials = getGoogleCredentials("search-console");
  if (!credentials) {
    return NextResponse.redirect(
      connectionResultUrl(request, "search-console", "error", "config"),
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = getOAuthRedirectUri("search-console", request);
  const params = new URLSearchParams({
    client_id: credentials.clientId,
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
