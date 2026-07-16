import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";

function envReady(...names: string[]) {
  return names.every((name) => {
    const value = process.env[name]?.trim();
    return Boolean(value && !value.includes("여기에") && !value.includes("your_"));
  });
}

async function safeCount(table: string, filter?: { column: string; value: string }) {
  try {
    const supabase = createAdminClient();
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    if (filter) query = query.eq(filter.column, filter.value);
    const { count, error } = await query;
    if (error) return null;
    return count || 0;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const encryptedGoogleToken = request.cookies.get("gy_google_token")?.value || request.cookies.get("gy_gsc_token")?.value;
  const googleConnected = Boolean(decryptConnectionValue<OAuthToken>(encryptedGoogleToken));

  const services = [
    { key: "openai", name: "OpenAI", ready: envReady("OPENAI_API_KEY"), purpose: "글·SEO·전략 생성" },
    { key: "supabase", name: "Supabase", ready: envReady("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"), purpose: "DB·Storage·작업 기록" },
    { key: "runway", name: "Runway", ready: envReady("RUNWAYML_API_SECRET"), purpose: "쇼츠 영상 생성" },
    { key: "google", name: "Google Growth", ready: googleConnected && envReady("GA4_PROPERTY_ID", "SEARCH_CONSOLE_SITE_URL"), purpose: "Search Console·GA4" },
    { key: "blogger", name: "Blogger", ready: envReady("BLOGGER_CLIENT_ID", "BLOGGER_CLIENT_SECRET") || envReady("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), purpose: "블로그 게시" },
    { key: "youtube", name: "YouTube", ready: envReady("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"), purpose: "쇼츠 업로드" },
  ];

  const [products, contents, creatives, publishPending, automationPending, automationFailed, seoReports] = await Promise.all([
    safeCount("products"),
    safeCount("ai_contents"),
    safeCount("creative_assets"),
    safeCount("publish_jobs", { column: "status", value: "pending" }),
    safeCount("automation_jobs", { column: "status", value: "pending" }),
    safeCount("automation_jobs", { column: "status", value: "failed" }),
    safeCount("seo_reports"),
  ]);

  const connected = services.filter((service) => service.ready).length;
  const dataSignals = [products, contents, creatives, publishPending, automationPending, automationFailed, seoReports].filter((value) => value !== null).length;
  const readiness = Math.round((connected / services.length) * 70 + (dataSignals / 7) * 30);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    readiness,
    services,
    metrics: {
      products: products ?? 0,
      contents: contents ?? 0,
      creatives: creatives ?? 0,
      seoReports: seoReports ?? 0,
      publishPending: publishPending ?? 0,
      automationPending: automationPending ?? 0,
      automationFailed: automationFailed ?? 0,
    },
    nextActions: [
      automationFailed ? `${automationFailed}개의 실패 자동화 작업을 점검하세요.` : "자동화 실패 작업이 없습니다.",
      publishPending ? `${publishPending}개의 게시 대기 작업을 검수하세요.` : "게시 대기열이 비어 있습니다.",
      !googleConnected ? "Google 통합 연결을 완료하세요." : "Search Console·GA4 연결이 준비되었습니다.",
    ],
  });
}
