import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import { publicReferenceMetadata } from "@/lib/creative-studio-pro/integration";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChinaPlatform = "douyin" | "xiaohongshu";
type SearchPlatform = ChinaPlatform | "all";

type SearchCandidate = {
  platform: ChinaPlatform;
  url: string;
  title: string;
};

type CachedSearch = {
  expiresAt: number;
  payload: Record<string, unknown>;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_LIMIT_WINDOW_MS = 60 * 1000;
const SEARCH_LIMIT_PER_WINDOW = 8;
const cache = new Map<string, CachedSearch>();
const requestLog = new Map<string, number[]>();

const platformConfig: Record<ChinaPlatform, { label: string; domains: string[] }> = {
  douyin: {
    label: "도우인",
    domains: ["douyin.com", "iesdouyin.com"],
  },
  xiaohongshu: {
    label: "샤오홍슈",
    domains: ["xiaohongshu.com", "xhslink.com"],
  },
};

function platformForUrl(value: string): ChinaPlatform | null {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (hostname === "douyin.com" || hostname.endsWith(".douyin.com") || hostname.endsWith(".iesdouyin.com")) return "douyin";
    if (hostname === "xiaohongshu.com" || hostname.endsWith(".xiaohongshu.com") || hostname === "xhslink.com" || hostname.endsWith(".xhslink.com")) return "xiaohongshu";
  } catch {
    return null;
  }
  return null;
}

function cleanTitle(value: string, fallback: string) {
  const title = value.replace(/\s+/g, " ").trim();
  return (title || fallback).slice(0, 160);
}

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "owner";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((time) => now - time < SEARCH_LIMIT_WINDOW_MS);
  if (recent.length >= SEARCH_LIMIT_PER_WINDOW) {
    requestLog.set(key, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(key, recent);
  return false;
}

async function searchPlatform(openai: OpenAI, query: string, platform: ChinaPlatform, limit: number) {
  const config = platformConfig[platform];
  const response = await openai.responses.create({
    model: process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-5.6",
    tools: [{
      type: "web_search",
      filters: { allowed_domains: config.domains },
      search_context_size: "low",
    }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    max_output_tokens: 900,
    input: [
      `상품 검색어: ${query}`,
      `검색 대상: ${config.label}`,
      `공개 웹에 색인된 ${config.label}의 개별 영상·노트·상품 사용 장면 페이지를 최대 ${limit}개 찾으세요.`,
      "한국어 상품명이면 자연스러운 중국어 간체 상품명과 사용 상황 키워드로도 검색하세요.",
      "홈, 로그인, 검색결과, 사용자 프로필 페이지보다 개별 콘텐츠 페이지를 우선하세요.",
      "각 후보를 짧은 제목 목록으로 쓰고 반드시 해당 원문 페이지를 인용하세요.",
      "조회수·판매량·인기 순위를 추정하거나 만들지 마세요. 검색으로 확인되지 않은 결과도 만들지 마세요.",
    ].join("\n"),
  });

  const candidates = new Map<string, SearchCandidate>();

  for (const item of response.output) {
    if (item.type === "message") {
      for (const part of item.content) {
        if (part.type !== "output_text") continue;
        for (const annotation of part.annotations) {
          if (annotation.type !== "url_citation") continue;
          const detectedPlatform = platformForUrl(annotation.url);
          if (detectedPlatform !== platform) continue;
          candidates.set(annotation.url, {
            platform,
            url: annotation.url,
            title: cleanTitle(annotation.title, `${config.label} 공개 콘텐츠`),
          });
        }
      }
    }
    if (item.type === "web_search_call" && item.action.type === "search") {
      for (const source of item.action.sources || []) {
        const detectedPlatform = platformForUrl(source.url);
        if (detectedPlatform !== platform || candidates.has(source.url)) continue;
        candidates.set(source.url, {
          platform,
          url: source.url,
          title: `${config.label} 공개 콘텐츠`,
        });
      }
    }
  }

  return Array.from(candidates.values()).slice(0, limit);
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, message: "OPENAI_API_KEY가 없어 사이트 내부 검색을 실행할 수 없습니다." }, { status: 503 });
    }
    if (isRateLimited(clientKey(request))) {
      return NextResponse.json({ success: false, message: "검색 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const body = await request.json() as { query?: unknown; platform?: unknown; limit?: unknown };
    const query = String(body.query || "").replace(/\s+/g, " ").trim();
    const platform = (["all", "douyin", "xiaohongshu"] as const).includes(body.platform as SearchPlatform)
      ? body.platform as SearchPlatform
      : "all";
    const requestedLimit = Math.round(Number(body.limit) || 12);
    const totalLimit = Math.max(4, Math.min(12, requestedLimit));

    if (query.length < 2 || query.length > 100) {
      return NextResponse.json({ success: false, message: "상품명이나 검색어를 2~100자로 입력해주세요." }, { status: 400 });
    }

    const cacheKey = `${platform}:${query.toLocaleLowerCase()}:${totalLimit}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ ...cached.payload, cached: true });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const platforms: ChinaPlatform[] = platform === "all" ? ["douyin", "xiaohongshu"] : [platform];
    const perPlatformLimit = platform === "all" ? Math.ceil(totalLimit / 2) : totalLimit;
    const settled = await Promise.allSettled(platforms.map((item) => searchPlatform(openai, query, item, perPlatformLimit)));
    const candidates = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const failedPlatforms = settled.flatMap((result, index) => result.status === "rejected" ? [platforms[index]] : []);
    if (failedPlatforms.length === platforms.length && candidates.length === 0) {
      throw new Error("공개 웹 검색 서비스가 응답하지 않았습니다. 잠시 후 다시 시도해주세요.");
    }

    const uniqueCandidates = Array.from(new Map(candidates.map((item) => [item.url, item])).values()).slice(0, totalLimit);
    const metadata = await Promise.all(uniqueCandidates.map((item) => publicReferenceMetadata(item.url)));
    const results = uniqueCandidates.map((item, index) => {
      const fallbackTitle = `${platformConfig[item.platform].label} 공개 콘텐츠`;
      const searchTitle = item.title === fallbackTitle ? "" : item.title;
      return {
        id: `china-search-${item.platform}-${index}-${Buffer.from(item.url).toString("base64url").slice(0, 16)}`,
        platform: item.platform,
        title: cleanTitle(searchTitle || metadata[index]?.title || fallbackTitle, fallbackTitle),
        url: item.url,
        thumbnailUrl: metadata[index]?.thumbnailUrl || "",
        note: `${query} 관련 공개 웹 색인 결과 · 원본 파일 아님`,
        rightsStatus: "unverified" as const,
        canUseOriginal: false,
        sourceLabel: "OpenAI 공개 웹 검색",
      };
    });

    const payload = {
      success: true,
      query,
      platform,
      results,
      failedPlatforms,
      searchedAt: new Date().toISOString(),
      message: results.length
        ? `${results.length}개의 공개 콘텐츠 후보를 찾았습니다. 필요한 카드를 골라 AI 소스함에 담으세요.${failedPlatforms.length ? " 일부 플랫폼 검색은 응답이 늦어 제외했습니다." : ""}`
        : "공개 웹에 색인된 결과를 찾지 못했습니다. 중국어 간체 키워드로 바꾸거나 직접 링크 추가를 이용해주세요.",
      usageRule: "검색 카드는 구조 분석용입니다. 원본 영상을 최종 편집에 사용하려면 권리 확인 파일을 별도로 업로드해야 합니다.",
    };
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "중국 플랫폼 내부 검색에 실패했습니다.",
    }, { status: 500 });
  }
}
