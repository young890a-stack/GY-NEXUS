import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleCredentials,
  getNaverCredentials,
  getPublicConnectionConfig,
} from "@/lib/connections/oauth-config";
import { connectionEncryptionReady } from "@/lib/connections/secure-cookie";

export async function GET(request: NextRequest) {
  const publicConfig = getPublicConnectionConfig(request);
  const encryptionReady = connectionEncryptionReady();
  const siteUrlIsHttps = publicConfig.siteUrl.startsWith("https://");
  const youtube = getGoogleCredentials("youtube");
  const blogger = getGoogleCredentials("blogger");
  const searchConsole = getGoogleCredentials("search-console");
  const naver = getNaverCredentials();

  return NextResponse.json({
    success: true,
    ...publicConfig,
    encryptionReady,
    credentials: {
      youtube: { ready: Boolean(youtube), source: youtube?.source || null },
      blogger: { ready: Boolean(blogger), source: blogger?.source || null },
      naver: { ready: Boolean(naver), source: naver?.source || null },
      "search-console": {
        ready: Boolean(searchConsole),
        source: searchConsole?.source || null,
      },
      coupang: {
        ready: Boolean(
          process.env.COUPANG_ACCESS_KEY?.trim() && process.env.COUPANG_SECRET_KEY?.trim(),
        ),
        source: "Coupang Partners",
      },
      temu: {
        ready: Boolean(
          process.env.TEMU_AFFILIATE_ID?.trim() ||
            process.env.TEMU_AFFILIATE_LINK_TEMPLATE?.trim(),
        ),
        source: "Temu Affiliate",
      },
    },
    checks: [
      {
        id: "site-url",
        label: "운영 사이트 주소",
        ok: process.env.NODE_ENV !== "production" || siteUrlIsHttps,
        detail: publicConfig.siteUrl,
      },
      {
        id: "token-storage",
        label: "연동 토큰 암호화",
        ok: encryptionReady,
        detail: encryptionReady
          ? "서버 전용 비밀키로 안전하게 저장할 준비가 됐습니다."
          : "SUPABASE_SERVICE_ROLE_KEY 또는 CONNECTION_ENCRYPTION_KEY가 필요합니다.",
      },
      {
        id: "callback-routes",
        label: "콜백 경로",
        ok: Object.values(publicConfig.callbacks).every((value) => value.startsWith(publicConfig.siteUrl)),
        detail: "서비스별 콜백 주소를 아래에서 복사해 외부 개발자 콘솔에 등록하세요.",
      },
    ],
  });
}
