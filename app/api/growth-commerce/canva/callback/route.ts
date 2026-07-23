import { NextRequest, NextResponse } from "next/server";
import { CONNECTION_COOKIE_OPTIONS, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import { canvaCredentials, canvaRedirectUri, type CanvaToken } from "@/lib/growth-commerce/canva";

export async function GET(request: NextRequest) {
  const fail = (reason: string) => {
    const response = NextResponse.redirect(new URL(`/admin/learning-engine?error=${encodeURIComponent(reason)}`, process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin));
    response.cookies.delete("gy_canva_state"); response.cookies.delete("gy_canva_verifier"); return response;
  };
  const credentials = canvaCredentials();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("gy_canva_state")?.value;
  const verifier = request.cookies.get("gy_canva_verifier")?.value;
  if (!credentials) return fail("canva_config");
  if (!code || !state || state !== expected || !verifier) return fail("canva_state");
  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64");
  const tokenResponse = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: canvaRedirectUri(request) }), cache: "no-store",
  });
  const data = await tokenResponse.json().catch(() => ({})) as Partial<CanvaToken> & { message?: string };
  if (!tokenResponse.ok || !data.access_token) return fail("canva_token");
  const response = NextResponse.redirect(new URL("/admin/learning-engine?connected=canva", process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin));
  response.cookies.set("gy_canva_token", encryptConnectionValue({ ...data, created_at: Date.now() } as CanvaToken), CONNECTION_COOKIE_OPTIONS);
  response.cookies.delete("gy_canva_state"); response.cookies.delete("gy_canva_verifier");
  return response;
}
