import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectionResultUrl, getGoogleCredentials, getOAuthRedirectUri } from "@/lib/connections/oauth-config";

export async function GET(request: NextRequest) {
  const credentials = getGoogleCredentials("youtube");
  if (!credentials) return NextResponse.redirect(connectionResultUrl(request, "youtube", "error", "config"));

  const state = crypto.randomBytes(24).toString("hex");
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: getOAuthRedirectUri("youtube", request),
    response_type: "code",
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ].join(" "),
    state,
  });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set("gy_youtube_state", state, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600,
  });
  return response;
}
