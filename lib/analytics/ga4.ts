import type { OAuthToken } from "@/lib/connections/types";

export const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function credentials() {
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.SEARCH_CONSOLE_CLIENT_ID ||
    process.env.BLOGGER_CLIENT_ID ||
    process.env.YOUTUBE_CLIENT_ID
  )?.trim();
  const clientSecret = (
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.SEARCH_CONSOLE_CLIENT_SECRET ||
    process.env.BLOGGER_CLIENT_SECRET ||
    process.env.YOUTUBE_CLIENT_SECRET
  )?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth Client ID/Secret이 없습니다.");
  }
  return { clientId, clientSecret };
}

export async function getGoogleAccessToken(token: OAuthToken): Promise<string> {
  const expiresAt = token.created_at + Math.max(0, Number(token.expires_in || 3600) - 120) * 1000;
  if (token.access_token && Date.now() < expiresAt) return token.access_token;
  if (!token.refresh_token) throw new Error("Google refresh token이 없습니다. 다시 연결해주세요.");

  const { clientId, clientSecret } = credentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Google 토큰 갱신 실패: ${await response.text()}`);
  }
  const json = (await response.json()) as { access_token: string };
  return json.access_token;
}

export type Ga4Summary = {
  activeUsers: number;
  totalUsers: number;
  sessions: number;
  views: number;
  engagementRate: number;
  averageSessionDuration: number;
  topPages: Array<{ path: string; title: string; views: number; users: number }>;
  channels: Array<{ channel: string; sessions: number; users: number }>;
};

export async function queryGa4Summary(accessToken: string, propertyId: string): Promise<Ga4Summary> {
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [
        { name: "activeUsers" },
        { name: "totalUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "engagementRate" },
        { name: "averageSessionDuration" },
      ],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 20,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`GA4 보고서 조회 실패: ${await response.text()}`);
  }
  const json = (await response.json()) as {
    rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
    totals?: Array<{ metricValues?: Array<{ value?: string }> }>;
  };

  const n = (value?: string) => Number(value || 0);
  const totals = json.totals?.[0]?.metricValues || [];
  const topPages = (json.rows || []).map((row) => ({
    path: row.dimensionValues?.[0]?.value || "/",
    title: row.dimensionValues?.[1]?.value || "제목 없음",
    views: n(row.metricValues?.[3]?.value),
    users: n(row.metricValues?.[1]?.value),
  }));

  const channelResponse = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
    cache: "no-store",
  });
  const channelJson = channelResponse.ok
    ? ((await channelResponse.json()) as {
        rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
      })
    : { rows: [] };

  return {
    activeUsers: n(totals[0]?.value),
    totalUsers: n(totals[1]?.value),
    sessions: n(totals[2]?.value),
    views: n(totals[3]?.value),
    engagementRate: n(totals[4]?.value),
    averageSessionDuration: n(totals[5]?.value),
    topPages,
    channels: (channelJson.rows || []).map((row) => ({
      channel: row.dimensionValues?.[0]?.value || "Unassigned",
      sessions: n(row.metricValues?.[0]?.value),
      users: n(row.metricValues?.[1]?.value),
    })),
  };
}
