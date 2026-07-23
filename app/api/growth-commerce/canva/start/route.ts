import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { canvaCredentials, canvaRedirectUri, createPkce } from "@/lib/growth-commerce/canva";

export async function GET(request: NextRequest) {
  const credentials = canvaCredentials();
  if (!credentials) return NextResponse.redirect(new URL("/admin/learning-engine?error=canva_config", request.url));
  const state = crypto.randomBytes(24).toString("hex");
  const { verifier, challenge } = createPkce();
  const params = new URLSearchParams({
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "asset:read asset:write design:content:write design:meta:read profile:read",
    response_type: "code",
    client_id: credentials.clientId,
    redirect_uri: canvaRedirectUri(request),
    state,
  });
  const response = NextResponse.redirect(`https://www.canva.com/api/oauth/authorize?${params}`);
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };
  response.cookies.set("gy_canva_state", state, options);
  response.cookies.set("gy_canva_verifier", verifier, options);
  return response;
}
