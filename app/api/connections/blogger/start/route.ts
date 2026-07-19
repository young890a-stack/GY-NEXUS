import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  connectionResultUrl,
  getGoogleCredentials,
  getOAuthRedirectUri,
} from "@/lib/connections/oauth-config";

export async function GET(request: NextRequest) {
  const credentials = getGoogleCredentials("blogger");
  if (!credentials) {
    return NextResponse.redirect(connectionResultUrl(request, "blogger", "error", "config"));
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = getOAuthRedirectUri("blogger", request);
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "select_account consent",
    include_granted_scopes: "true",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/blogger",
    ].join(" "),
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  response.cookies.set("gy_blogger_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
