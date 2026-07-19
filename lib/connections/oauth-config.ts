import type { NextRequest } from "next/server";

export type OAuthProvider = "youtube" | "blogger" | "naver" | "search-console";

const callbackPaths: Record<OAuthProvider, string> = {
  youtube: "/api/connections/youtube/callback",
  blogger: "/api/connections/blogger/callback",
  naver: "/api/connections/naver/callback",
  "search-console": "/api/search-console/callback",
};

// 예전 버전에 안내했던 주소도 계속 받는다. 외부 콘솔에 이미 등록된 주소를
// 당장 바꾸지 않아도 start/callback 양쪽에서 같은 redirect_uri를 사용한다.
const allowedCallbackPaths: Record<OAuthProvider, string[]> = {
  youtube: [callbackPaths.youtube, "/api/auth/youtube/callback"],
  blogger: [callbackPaths.blogger, "/api/auth/blogger/callback"],
  naver: [callbackPaths.naver, "/api/auth/naver/callback"],
  "search-console": [callbackPaths["search-console"], "/api/connections/google/callback"],
};

const redirectEnvKeys: Record<OAuthProvider, string> = {
  youtube: "YOUTUBE_REDIRECT_URI",
  blogger: "BLOGGER_REDIRECT_URI",
  naver: "NAVER_REDIRECT_URI",
  "search-console": "SEARCH_CONSOLE_REDIRECT_URI",
};

function cleanOrigin(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!new Set(["http:", "https:"]).has(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalRequest(request: NextRequest) {
  return new Set(["localhost", "127.0.0.1", "[::1]"]).has(request.nextUrl.hostname);
}

export function getCanonicalOrigin(request: NextRequest) {
  if (isLocalRequest(request)) return request.nextUrl.origin;
  return cleanOrigin(process.env.NEXT_PUBLIC_SITE_URL) || request.nextUrl.origin;
}

export function getOAuthRedirectUri(provider: OAuthProvider, request: NextRequest) {
  if (!isLocalRequest(request)) {
    const configured = process.env[redirectEnvKeys[provider]]?.trim();
    if (configured) {
      try {
        const url = new URL(configured);
        if (
          url.protocol === "https:" &&
          allowedCallbackPaths[provider].includes(url.pathname) &&
          !url.search &&
          !url.hash
        ) {
          return url.toString();
        }
      } catch {}
    }
  }
  return new URL(callbackPaths[provider], getCanonicalOrigin(request)).toString();
}

type CredentialPair = { clientId: string; clientSecret: string; source: string };

function firstCredentialPair(candidates: Array<[string, string, string]>): CredentialPair | null {
  for (const [idKey, secretKey, source] of candidates) {
    const clientId = process.env[idKey]?.trim();
    const clientSecret = process.env[secretKey]?.trim();
    if (clientId && clientSecret) return { clientId, clientSecret, source };
  }
  return null;
}

export function getGoogleCredentials(provider: "youtube" | "blogger" | "search-console") {
  if (provider === "youtube") {
    return firstCredentialPair([
      ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YouTube 전용"],
      ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "Google 공통"],
    ]);
  }
  if (provider === "blogger") {
    return firstCredentialPair([
      ["BLOGGER_CLIENT_ID", "BLOGGER_CLIENT_SECRET", "Blogger 전용"],
      ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "Google 공통"],
      ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YouTube 전용 공유"],
    ]);
  }
  return firstCredentialPair([
    ["SEARCH_CONSOLE_CLIENT_ID", "SEARCH_CONSOLE_CLIENT_SECRET", "Search Console 전용"],
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "Google 공통"],
    ["BLOGGER_CLIENT_ID", "BLOGGER_CLIENT_SECRET", "Blogger 전용 공유"],
    ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YouTube 전용 공유"],
  ]);
}

export function getNaverCredentials() {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret, source: "Naver" } : null;
}

export function connectionResultUrl(
  request: NextRequest,
  provider: OAuthProvider,
  result: "connected" | "error",
  reason?: string,
) {
  const url = new URL("/admin/connections", getCanonicalOrigin(request));
  url.searchParams.set(result, provider);
  if (reason) url.searchParams.set("reason", reason.replace(/[^a-z0-9_-]/gi, "").slice(0, 50));
  return url;
}

export function getPublicConnectionConfig(request: NextRequest) {
  return {
    siteUrl: getCanonicalOrigin(request),
    callbacks: {
      youtube: getOAuthRedirectUri("youtube", request),
      blogger: getOAuthRedirectUri("blogger", request),
      naver: getOAuthRedirectUri("naver", request),
      "search-console": getOAuthRedirectUri("search-console", request),
    },
  };
}
