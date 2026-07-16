import { NextRequest, NextResponse } from "next/server";
import { decryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";
import { getGoogleAccessToken, queryGa4Summary } from "@/lib/analytics/ga4";
import { listSearchConsoleSites, querySearchPerformance } from "@/lib/search-console/client";

function isoDate(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const raw = request.cookies.get("gy_google_token")?.value || request.cookies.get("gy_gsc_token")?.value;
    const token = decryptConnectionValue<OAuthToken>(raw);
    if (!token) {
      return NextResponse.json({ ok: false, connected: false, error: "Google OAuth 연결이 필요합니다." }, { status: 401 });
    }

    const accessToken = await getGoogleAccessToken(token);
    const propertyId = (process.env.GA4_PROPERTY_ID || "").trim();
    const preferredSite = (process.env.SEARCH_CONSOLE_SITE_URL || "").trim();

    const siteResult = await listSearchConsoleSites(accessToken);
    const sites = siteResult.siteEntry || [];
    const siteUrl = preferredSite || sites.find((site) => site.permissionLevel !== "siteUnverifiedUser")?.siteUrl || sites[0]?.siteUrl || "";

    let searchConsole: unknown = null;
    let searchConsoleError = "";
    if (siteUrl) {
      try {
        searchConsole = await querySearchPerformance(accessToken, {
          siteUrl,
          startDate: isoDate(28),
          endDate: isoDate(1),
          rowLimit: 250,
        });
      } catch (error) {
        searchConsoleError = error instanceof Error ? error.message : "Search Console 조회 실패";
      }
    }

    let ga4: unknown = null;
    let ga4Error = "";
    if (propertyId) {
      try {
        ga4 = await queryGa4Summary(accessToken, propertyId);
      } catch (error) {
        ga4Error = error instanceof Error ? error.message : "GA4 조회 실패";
      }
    } else {
      ga4Error = "GA4_PROPERTY_ID가 비어 있습니다.";
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      siteUrl,
      sites,
      searchConsole,
      searchConsoleError,
      ga4,
      ga4Error,
      period: { startDate: isoDate(28), endDate: isoDate(1) },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, connected: true, error: error instanceof Error ? error.message : "성장 데이터 조회 실패" },
      { status: 500 }
    );
  }
}
