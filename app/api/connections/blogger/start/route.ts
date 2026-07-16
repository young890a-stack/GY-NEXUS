import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = (process.env.BLOGGER_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID)?.trim();
  if (!clientId) {
    return NextResponse.redirect(new URL("/admin/connections?error=blogger_config", request.url));
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${request.nextUrl.origin}/api/connections/blogger/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
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
