import { NextRequest, NextResponse } from "next/server";
import { getGoogleCredentials, getNaverCredentials } from "@/lib/connections/oauth-config";
import {
  CONNECTION_COOKIE_OPTIONS,
  connectionEncryptionReady,
  decryptConnectionValue,
  encryptConnectionValue,
} from "@/lib/connections/secure-cookie";
import type { ConnectionState, OAuthToken } from "@/lib/connections/types";
import { getSearchConsoleAccessToken, listSearchConsoleSites } from "@/lib/search-console/client";
import { verifyAffiliateProof } from "@/lib/affiliate/verification-proof";
import { createAdminClient } from "@/lib/supabase/admin";

type StateResult = { state: ConnectionState; refreshedToken?: OAuthToken };

async function refreshGoogleToken(
  token: OAuthToken,
  clientId: string,
  clientSecret: string,
): Promise<OAuthToken | null> {
  if (!token.refresh_token) return null;
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
  if (!response.ok) return null;
  const refreshed = (await response.json()) as Partial<OAuthToken>;
  if (!refreshed.access_token) return null;
  return {
    ...token,
    ...refreshed,
    refresh_token: token.refresh_token,
    created_at: Date.now(),
  };
}

async function youtubeState(request: NextRequest): Promise<StateResult> {
  const credentials = getGoogleCredentials("youtube");
  let token = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_youtube_token")?.value);
  if (!credentials) {
    return { state: { id: "youtube", name: "YouTube", configured: false, connected: false, detail: "Google OAuth Client ID와 Secret이 필요합니다." } };
  }
  if (!token?.access_token) {
    return { state: { id: "youtube", name: "YouTube", configured: true, connected: false, detail: "Google 계정에서 채널 조회와 업로드 권한을 승인하세요." } };
  }
  try {
    let response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    let refreshedToken: OAuthToken | undefined;
    if (response.status === 401) {
      const refreshed = await refreshGoogleToken(token, credentials.clientId, credentials.clientSecret);
      if (refreshed) {
        token = refreshed;
        refreshedToken = refreshed;
        response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
          headers: { Authorization: `Bearer ${token.access_token}` },
          cache: "no-store",
        });
      }
    }
    const data = (await response.json()) as {
      items?: Array<{ snippet?: { title?: string } }>;
      error?: { message?: string };
    };
    if (!response.ok || !data.items?.length) {
      return { state: { id: "youtube", name: "YouTube", configured: true, connected: false, detail: data.error?.message || "연결된 YouTube 채널을 확인할 수 없습니다." } };
    }
    return {
      state: {
        id: "youtube",
        name: "YouTube",
        configured: true,
        connected: true,
        detail: "채널 조회와 영상 업로드 권한이 정상입니다.",
        account: data.items[0]?.snippet?.title || "YouTube 채널",
      },
      refreshedToken,
    };
  } catch {
    return { state: { id: "youtube", name: "YouTube", configured: true, connected: false, detail: "YouTube 상태 확인 중 네트워크 오류가 발생했습니다." } };
  }
}

async function bloggerState(request: NextRequest): Promise<StateResult> {
  const credentials = getGoogleCredentials("blogger");
  let token = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_blogger_token")?.value);
  if (!credentials) {
    return { state: { id: "blogger", name: "Google Blogger", configured: false, connected: false, detail: "Blogger용 Google OAuth Client ID와 Secret이 필요합니다." } };
  }
  if (!token?.access_token) {
    return { state: { id: "blogger", name: "Google Blogger", configured: true, connected: false, detail: "Google 계정에서 Blogger 권한을 승인하세요." } };
  }
  try {
    let response = await fetch("https://www.googleapis.com/blogger/v3/users/self/blogs", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    let refreshedToken: OAuthToken | undefined;
    if (response.status === 401) {
      const refreshed = await refreshGoogleToken(token, credentials.clientId, credentials.clientSecret);
      if (refreshed) {
        token = refreshed;
        refreshedToken = refreshed;
        response = await fetch("https://www.googleapis.com/blogger/v3/users/self/blogs", {
          headers: { Authorization: `Bearer ${token.access_token}` },
          cache: "no-store",
        });
      }
    }
    const data = (await response.json()) as {
      items?: Array<{ id?: string; name?: string; url?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      return { state: { id: "blogger", name: "Google Blogger", configured: true, connected: false, detail: data.error?.message || "Blogger API를 확인할 수 없습니다." } };
    }
    const blogs = data.items || [];
    const preferred = process.env.BLOGGER_BLOG_ID?.trim();
    const selected = blogs.find((blog) => blog.id === preferred) || blogs[0];
    return {
      state: {
        id: "blogger",
        name: "Google Blogger",
        configured: true,
        connected: true,
        detail: blogs.length ? `${blogs.length}개 블로그 권한이 정상입니다.` : "계정은 연결됐지만 Blogger 블로그가 없습니다.",
        account: selected?.name || selected?.url || "Google 계정",
        limitation: blogs.length ? `게시 대상 Blog ID: ${selected?.id}` : "Blogger에서 블로그를 먼저 생성하세요.",
      },
      refreshedToken,
    };
  } catch {
    return { state: { id: "blogger", name: "Google Blogger", configured: true, connected: false, detail: "Blogger 상태 확인 중 네트워크 오류가 발생했습니다." } };
  }
}

async function naverState(request: NextRequest): Promise<StateResult> {
  const credentials = getNaverCredentials();
  const token = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_naver_token")?.value);
  const limitation = "네이버 블로그 쓰기는 공식 공개 API 제약 때문에 검수 후 복사·수동 발행으로 운영합니다.";
  if (!credentials) {
    return { state: { id: "naver", name: "Naver", configured: false, connected: false, detail: "Naver Client ID와 Secret이 필요합니다.", limitation } };
  }
  if (!token?.access_token) {
    return { state: { id: "naver", name: "Naver", configured: true, connected: false, detail: "네이버 계정 연결이 필요합니다.", limitation } };
  }
  try {
    const response = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    const data = (await response.json()) as {
      resultcode?: string;
      response?: { nickname?: string; name?: string; email?: string };
    };
    if (!response.ok || data.resultcode !== "00") throw new Error("profile");
    return { state: { id: "naver", name: "Naver", configured: true, connected: true, detail: "네이버 로그인과 프로필 조회가 정상입니다.", account: data.response?.nickname || data.response?.name || data.response?.email || "네이버 계정", limitation } };
  } catch {
    return { state: { id: "naver", name: "Naver", configured: true, connected: false, detail: "네이버 토큰이 만료됐거나 권한 확인에 실패했습니다. 다시 연결하세요.", limitation } };
  }
}

async function searchConsoleState(request: NextRequest): Promise<StateResult> {
  const credentials = getGoogleCredentials("search-console");
  const token = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_gsc_token")?.value);
  if (!credentials) {
    return { state: { id: "search-console", name: "Search Console · GA4", configured: false, connected: false, detail: "Search Console용 Google OAuth Client ID와 Secret이 필요합니다." } };
  }
  if (!token?.access_token) {
    return { state: { id: "search-console", name: "Search Console · GA4", configured: true, connected: false, detail: "Google 계정에서 검색·분석 읽기 권한을 승인하세요." } };
  }
  try {
    const accessToken = await getSearchConsoleAccessToken(token);
    const data = await listSearchConsoleSites(accessToken);
    const sites = data.siteEntry || [];
    return { state: { id: "search-console", name: "Search Console · GA4", configured: true, connected: true, detail: `${sites.length}개 Search Console 사이트 접근 권한이 정상입니다.`, account: sites[0]?.siteUrl || process.env.SEARCH_CONSOLE_SITE_URL?.trim() || "Google 계정", limitation: process.env.GA4_PROPERTY_ID?.trim() ? "GA4 Property ID도 등록되어 있습니다." : "GA4 통계를 사용하려면 GA4_PROPERTY_ID를 등록하세요." } };
  } catch {
    return { state: { id: "search-console", name: "Search Console · GA4", configured: true, connected: false, detail: "Google 검색·분석 권한을 다시 연결해주세요." } };
  }
}

export async function GET(request: NextRequest) {
  const [youtube, blogger, naver, searchConsole] = await Promise.all([
    youtubeState(request),
    bloggerState(request),
    naverState(request),
    searchConsoleState(request),
  ]);
  const coupangConfigured = Boolean(
    process.env.COUPANG_ACCESS_KEY?.trim() && process.env.COUPANG_SECRET_KEY?.trim(),
  );
  const coupangCredential = `${process.env.COUPANG_ACCESS_KEY?.trim() || ""}:${process.env.COUPANG_SECRET_KEY?.trim() || ""}`;
  const coupangVerified = coupangConfigured && verifyAffiliateProof(
    request.cookies.get("gy_coupang_verified")?.value,
    "coupang",
    coupangCredential,
  );
  let temuStoredCount = 0;
  try {
    const supabase = createAdminClient();
    const [candidates, products] = await Promise.all([
      supabase.from("trend_products").select("id", { count: "exact", head: true }).eq("platform", "temu"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("platform", "temu"),
    ]);
    temuStoredCount = (candidates.count || 0) + (products.count || 0);
  } catch {
    temuStoredCount = 0;
  }
  const temuConfigured = Boolean(process.env.TEMU_AFFILIATE_ID?.trim() || temuStoredCount > 0);
  const temuCredential = process.env.TEMU_AFFILIATE_ID?.trim() || "stored-temu-share-links";
  const temuProof = verifyAffiliateProof(request.cookies.get("gy_temu_verified")?.value, "temu", temuCredential);
  const temuOperational = temuStoredCount > 0;

  const states: ConnectionState[] = [
    youtube.state,
    blogger.state,
    naver.state,
    searchConsole.state,
    {
      id: "coupang",
      name: "Coupang Partners",
      configured: coupangConfigured,
      connected: coupangConfigured && coupangVerified,
      operational: coupangConfigured && coupangVerified,
      mode: "api",
      detail: !coupangConfigured ? "Coupang Access Key와 Secret Key가 필요합니다." : coupangVerified ? "파트너스 API 서명·상품 조회·제휴 링크 응답을 최근 24시간 안에 확인했습니다." : "키가 등록됐습니다. 실제 API 연결 테스트를 실행하세요.",
      limitation: "API 권한이 승인된 계정에서만 골드박스·카테고리 베스트·키워드 검색을 자동 수집합니다.",
    },
    {
      id: "temu",
      name: "Temu Affiliate",
      configured: temuConfigured,
      connected: false,
      operational: temuOperational,
      mode: "share-link",
      detail: temuOperational
        ? `Temu 공유 링크 기반 후보·정식 상품 ${temuStoredCount}개가 저장되어 있습니다.${temuProof ? " 최근 운영 검증도 통과했습니다." : " 운영 확인 버튼으로 다시 검사할 수 있습니다."}`
        : "Temu 제휴 대시보드의 인기상품·상품검색에서 ‘공유’로 만든 링크를 등록해주세요.",
      limitation: "Seller API나 가짜 링크 템플릿을 요구하지 않습니다. 공개 제휴 API가 없는 계정은 실제 공유 링크를 검증·저장하는 방식으로 운영합니다.",
    },
  ];

  const response = NextResponse.json({
    success: true,
    connections: states,
    core: {
      openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
      supabase: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() &&
          process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
      ),
      encryption: connectionEncryptionReady(),
    },
  });
  try {
    if (youtube.refreshedToken) {
      response.cookies.set("gy_youtube_token", encryptConnectionValue(youtube.refreshedToken), CONNECTION_COOKIE_OPTIONS);
    }
    if (blogger.refreshedToken) {
      response.cookies.set("gy_blogger_token", encryptConnectionValue(blogger.refreshedToken), CONNECTION_COOKIE_OPTIONS);
    }
  } catch (error) {
    console.error("OAuth token refresh storage failed", error);
  }
  return response;
}
