import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import type { OAuthToken } from "@/lib/connections/types";

export type CanvaToken = OAuthToken & { refresh_token?: string };

export function canvaCredentials() {
  const clientId = process.env.CANVA_CLIENT_ID?.trim();
  const clientSecret = process.env.CANVA_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function canvaRedirectUri(request: NextRequest) {
  const configured = process.env.CANVA_REDIRECT_URI?.trim();
  if (configured) return configured;
  const origin = request.nextUrl.hostname === "localhost"
    ? request.nextUrl.origin
    : process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
  return new URL("/api/growth-commerce/canva/callback", origin).toString();
}

export function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function createPkce() {
  const verifier = base64Url(crypto.randomBytes(64));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export async function refreshCanvaToken(token: CanvaToken) {
  const credentials = canvaCredentials();
  if (!credentials || !token.refresh_token) return null;
  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64");
  const response = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: token.refresh_token }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = await response.json() as Partial<CanvaToken>;
  if (!data.access_token) return null;
  return { ...token, ...data, refresh_token: data.refresh_token || token.refresh_token, created_at: Date.now() } as CanvaToken;
}

export function tokenLikelyExpired(token: CanvaToken) {
  const seconds = Number(token.expires_in) || 0;
  return seconds > 0 && Date.now() > token.created_at + Math.max(0, seconds - 120) * 1000;
}

export async function canvaJson<T>(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://api.canva.com/rest/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as T & { code?: string; message?: string };
  if (!response.ok) throw new Error(data.message || data.code || `Canva API 오류 (${response.status})`);
  return data;
}
