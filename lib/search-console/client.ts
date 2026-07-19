import type { OAuthToken } from "@/lib/connections/types";
import { getGoogleCredentials } from "@/lib/connections/oauth-config";

export const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function credentials() {
  const pair = getGoogleCredentials("search-console");
  if (!pair) throw new Error("Google OAuth Client ID/Secret이 없습니다.");
  return pair;
}

export async function getSearchConsoleAccessToken(token: OAuthToken): Promise<string> {
  const expiresAt = token.created_at + Math.max(0, Number(token.expires_in || 3600) - 120) * 1000;
  if (token.access_token && Date.now() < expiresAt) return token.access_token;
  if (!token.refresh_token) throw new Error("Search Console refresh token이 없습니다. 다시 연결해주세요.");
  const { clientId, clientSecret } = credentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: token.refresh_token, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google 토큰 갱신 실패: ${await response.text()}`);
  const json = await response.json() as { access_token: string };
  return json.access_token;
}

export async function listSearchConsoleSites(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`Search Console 사이트 조회 실패: ${await response.text()}`);
  return response.json() as Promise<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>;
}

export async function querySearchPerformance(accessToken: string, input: { siteUrl: string; startDate: string; endDate: string; rowLimit?: number }) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: input.startDate, endDate: input.endDate, dimensions: ["query", "page"], rowLimit: input.rowLimit || 250, dataState: "all" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Search Console 성과 조회 실패: ${await response.text()}`);
  return response.json();
}
