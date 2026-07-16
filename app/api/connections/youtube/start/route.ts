import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();

  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        "/admin/connections?error=youtube_config",
        request.url,
      ),
    );
  }

  const state = crypto.randomBytes(24).toString("hex");

  const redirectUri =
    `${request.nextUrl.origin}/api/connections/youtube/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
    ].join(" "),
    state,
  });

  // 실제 Google OAuth 요청 주소 확인용 임시 로그
  console.log("Redirect URI:", redirectUri);
  console.log(
    "OAuth URL:",
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );

  response.cookies.set("gy_youtube_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return response;
}