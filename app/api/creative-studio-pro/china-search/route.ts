import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import { publicReferenceMetadata } from "@/lib/creative-studio-pro/integration";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChinaPlatform = "douyin" | "xiaohongshu";
type SearchPlatform = ChinaPlatform | "all";
type SearchMode = "popular" | "related";

type SearchCandidate = {
  platform: ChinaPlatform;
  url: string;
  title: string;
  sourceRank: number;
};

type DiscoveryKeyword = {
  simplifiedChinese: string;
  koreanMeaning: string;
  intent: "product" | "problem" | "use-case" | "review" | "viral";
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

const keywordSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    translatedProductName: { type: "string" },
    keywords: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          simplifiedChinese: { type: "string" },
          koreanMeaning: { type: "string" },
          intent: { type: "string", enum: ["product", "problem", "use-case", "review", "viral"] },
        },
        required: ["simplifiedChinese", "koreanMeaning", "intent"],
      },
    },
  },
  required: ["translatedProductName", "keywords"],
} as const;

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

async function generateDiscoveryKeywords(openai: OpenAI, query: string) {
  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_FAST_MODEL || process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-5.6",
      reasoning: { effort: "low" },
      input: [{
        role: "user",
        content: [{
          type: "input_text",
          text: [
            "당신은 한국 상품을 중국 숏폼 플랫폼에서 찾는 검색어 전문가다.",
            `대표가 입력한 한국어 또는 중국어 상품명: ${query}`,
            "상품의 정확한 중국어 간체명 1개와 실제 중국 사용자가 검색할 짧은 키워드 5~8개를 만든다.",
            "상품명, 해결 문제, 사용 상황, 후기/측정, 바이럴 표현을 고르게 포함한다.",
            "브랜드·효능·판매량·인기 수치를 만들지 말고 검색 가능한 자연스러운 표현만 쓴다.",
            "중복 표현을 제거하고 각 키워드는 2~12자 중국어 간체를 우선한다.",
          ].join("\n"),
        }],
      }],
      text: { format: { type: "json_schema", name: "gy_china_discovery_keywords", strict: true, schema: keywordSchema } },
      max_output_tokens: 1600,
    });
    const parsed = JSON.parse(response.output_text || "{}") as { translatedProductName?: string; keywords?: DiscoveryKeyword[] };
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.map((item) => ({
        simplifiedChinese: String(item.simplifiedChinese || "").replace(/\s+/g, " ").trim().slice(0, 40),
        koreanMeaning: String(item.koreanMeaning || "").replace(/\s+/g, " ").trim().slice(0, 80),
        intent: item.intent,
      })).filter((item) => item.simplifiedChinese).slice(0, 8)
      : [];
    const translatedProductName = String(parsed.translatedProductName || keywords[0]?.simplifiedChinese || "").trim().slice(0, 80);
    const koreanInput = /[\p{Script=Hangul}]/u.test(query);
    const chinesePlanIsValid = translatedProductName
      && keywords.length >= 5
      && (!koreanInput || (!/[\p{Script=Hangul}]/u.test(translatedProductName) && keywords.every((item) => !/[\p{Script=Hangul}]/u.test(item.simplifiedChinese))));
    if (!chinesePlanIsValid) throw new Error("Invalid Simplified Chinese search plan");
    return { translatedProductName, keywords };
  } catch {
    throw new Error("한국어를 중국어 간체 검색어로 변환하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
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

async function searchPlatform(openai: OpenAI, translatedProductName: string, keywords: DiscoveryKeyword[], platform: ChinaPlatform, limit: number, mode: SearchMode) {
  const config = platformConfig[platform];
  const chineseQuery = Array.from(new Set([translatedProductName, ...keywords.map((item) => item.simplifiedChinese)])).filter(Boolean).slice(0, 5).join(" / ");
  const searchGoal = mode === "popular"
    ? [
      "먼저 공개 좋아요, 반복 노출, 검색 상위 등 확인 가능한 인기 신호가 있는 개별 콘텐츠를 찾으세요.",
      "인기 수치를 확인할 수 없다면 추정하지 말고, 상품과 가장 밀접한 개별 콘텐츠만 후보로 남기세요.",
    ]
    : [
      "인기 신호가 확인되지 않았으므로 관련성 검색 단계입니다.",
      "상품명, 해결 문제, 사용 상황, 후기·비교 검색어로 상품과 가장 가까운 개별 콘텐츠를 찾으세요.",
    ];
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
      `중국어 검색어 후보: ${chineseQuery}`,
      `검색 대상: ${config.label}`,
      `공개 웹에 색인된 ${config.label}의 개별 세로형 쇼츠·영상 노트·상품 사용 장면 페이지를 최대 ${limit}개 찾으세요.`,
      ...searchGoal,
      "15~60초의 짧은 사용 장면, 문제 해결, 전후 비교, 후기형 콘텐츠를 우선하고 장시간 영상·라이브·모음집은 제외하세요.",
      "대표가 입력한 한국어 문장을 그대로 검색하지 말고, 위 중국어 상품명과 중국어 검색어 후보를 실제 검색에 사용하세요.",
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
            sourceRank: candidates.size + 1,
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
          sourceRank: candidates.size + 1,
        });
      }
    }
  }

  const executedQueries = response.output.flatMap((item) => item.type === "web_search_call" && item.action.type === "search"
    ? item.action.queries || (item.action.query ? [item.action.query] : [])
    : []);
  if (executedQueries.some((query) => /[\p{Script=Hangul}]/u.test(query))) {
    throw new Error(`${config.label} 검색에 한국어가 섞여 결과를 폐기했습니다.`);
  }
  return { candidates: Array.from(candidates.values()).slice(0, limit), executedQueries };
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
    const keywordPlan = await generateDiscoveryKeywords(openai, query);
    const platforms: ChinaPlatform[] = platform === "all" ? ["douyin", "xiaohongshu"] : [platform];
    const perPlatformLimit = platform === "all" ? Math.ceil(totalLimit / 2) : totalLimit;
    const runSearch = async (mode: SearchMode) => {
      const settled = await Promise.allSettled(platforms.map((item) => searchPlatform(openai, keywordPlan.translatedProductName, keywordPlan.keywords, item, perPlatformLimit, mode)));
      return {
        candidates: settled.flatMap((result) => result.status === "fulfilled" ? result.value.candidates : []),
        executedQueries: settled.flatMap((result) => result.status === "fulfilled" ? result.value.executedQueries : []),
        failedPlatforms: settled.flatMap((result, index) => result.status === "rejected" ? [platforms[index]] : []),
      };
    };

    const hydrateCandidates = async (candidates: SearchCandidate[]) => {
      const uniqueCandidates = Array.from(new Map(candidates.map((item) => [item.url, item])).values()).slice(0, totalLimit);
      const metadata = await Promise.all(uniqueCandidates.map((item) => publicReferenceMetadata(item.url)));
      return uniqueCandidates.map((item, index) => {
        const fallbackTitle = `${platformConfig[item.platform].label} 공개 콘텐츠`;
        const searchTitle = item.title === fallbackTitle ? "" : item.title;
        const engagement = metadata[index]?.engagement || { likes: null, comments: null, saves: null };
        const verifiedLikes = typeof engagement.likes === "number" ? engagement.likes : null;
        return {
          id: `china-search-${item.platform}-${index}-${Buffer.from(item.url).toString("base64url").slice(0, 16)}`,
          platform: item.platform,
          title: cleanTitle(searchTitle || metadata[index]?.title || fallbackTitle, fallbackTitle),
          url: item.url,
          thumbnailUrl: metadata[index]?.thumbnailUrl || "",
          durationSeconds: metadata[index]?.durationSeconds ?? null,
          engagement,
          sourceRank: item.sourceRank,
          popularityScore: verifiedLikes === null ? Math.max(1, 100 - item.sourceRank) : 1000 + Math.log10(verifiedLikes + 1) * 100,
          popularityLabel: verifiedLikes === null ? "관련 쇼츠" : `공개 좋아요 ${verifiedLikes.toLocaleString("ko-KR")}`,
          note: `${query} 관련 공개 웹 색인 결과 · 원본 파일 아님`,
          rightsStatus: "unverified" as const,
          canUseOriginal: false,
          sourceLabel: "OpenAI 공개 웹 검색",
        };
      })
        .filter((item) => item.durationSeconds === null || item.durationSeconds <= 60)
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, totalLimit);
    };

    const popularSearch = await runSearch("popular");
    let finalSearch = popularSearch;
    let results = await hydrateCandidates(popularSearch.candidates);
    let usedRelatedFallback = false;
    const initialPopularityEvidence = results.some((item) => typeof item.engagement.likes === "number" && item.engagement.likes > 0);
    let relatedExecutedQueries: string[] = [];

    if (!initialPopularityEvidence) {
      usedRelatedFallback = true;
      const relatedSearch = await runSearch("related");
      relatedExecutedQueries = relatedSearch.executedQueries;
      if (relatedSearch.candidates.length > 0 || popularSearch.candidates.length === 0) {
        finalSearch = relatedSearch;
      }
      if (relatedSearch.candidates.length > 0) {
        results = await hydrateCandidates(relatedSearch.candidates);
      }
    }

    const executedQueries = Array.from(new Set([...popularSearch.executedQueries, ...relatedExecutedQueries])).slice(0, 12);
    const failedPlatforms = finalSearch.failedPlatforms;
    if (failedPlatforms.length === platforms.length && results.length === 0) {
      throw new Error("공개 웹 검색 서비스가 응답하지 않았습니다. 잠시 후 다시 시도해주세요.");
    }
    const resultMode: SearchMode = !usedRelatedFallback && initialPopularityEvidence ? "popular" : "related";
    const searchableText = results.map((item) => item.title.toLocaleLowerCase()).join(" ");
    const keywords = keywordPlan.keywords.map((item, index) => {
      const evidenceCount = searchableText.split(item.simplifiedChinese.toLocaleLowerCase()).length - 1;
      return {
        ...item,
        evidenceCount,
        trendScore: Math.min(100, 58 + evidenceCount * 12 + Math.max(0, 8 - index) * 2),
        trendLabel: evidenceCount >= 2 ? "반복 노출" : evidenceCount === 1 ? "검색 결과 확인" : "중국어 확장어",
      };
    }).sort((a, b) => b.trendScore - a.trendScore);

    const payload = {
      success: true,
      query,
      translatedProductName: keywordPlan.translatedProductName,
      keywords,
      executedQueries,
      platform,
      resultMode,
      relatedFallbackApplied: usedRelatedFallback,
      searchStrategy: "korean-input-to-simplified-chinese-popular-then-related",
      results,
      failedPlatforms,
      searchedAt: new Date().toISOString(),
      message: results.length
        ? resultMode === "popular"
          ? `\"${query}\"을 \"${keywordPlan.translatedProductName}\"로 번역해 인기 신호가 확인된 쇼츠 ${results.length}개를 찾았습니다.${failedPlatforms.length ? " 일부 플랫폼 검색은 응답이 늦어 제외했습니다." : ""}`
          : `\"${query}\"을 \"${keywordPlan.translatedProductName}\"로 번역해 중국어로 검색했습니다. 확인 가능한 인기 쇼츠가 없어 관련 쇼츠 ${results.length}개를 보여드립니다.${failedPlatforms.length ? " 일부 플랫폼 검색은 응답이 늦어 제외했습니다." : ""}`
        : `\"${query}\"을 \"${keywordPlan.translatedProductName}\"로 번역해 검색했지만 인기·관련 쇼츠를 찾지 못했습니다. 아래 중국어 키워드 칩으로 다시 검색해주세요.`,
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
