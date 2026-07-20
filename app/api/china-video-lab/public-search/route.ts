import OpenAI from "openai";
import { NextResponse } from "next/server";
import { publicReferenceMetadata } from "@/lib/creative-studio-pro/integration";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChinaPlatform = "douyin" | "xiaohongshu";
type SearchPlatform = ChinaPlatform | "all";

type KeywordInput = {
  simplifiedChinese?: unknown;
  koreanMeaning?: unknown;
  intent?: unknown;
};

type SearchCandidate = {
  platform: ChinaPlatform;
  url: string;
  title: string;
  sourceRank: number;
};

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
    if (
      hostname === "douyin.com"
      || hostname.endsWith(".douyin.com")
      || hostname.endsWith(".iesdouyin.com")
    ) return "douyin";
    if (
      hostname === "xiaohongshu.com"
      || hostname.endsWith(".xiaohongshu.com")
      || hostname === "xhslink.com"
      || hostname.endsWith(".xhslink.com")
    ) return "xiaohongshu";
  } catch {
    return null;
  }
  return null;
}

function cleanTitle(value: string, fallback: string) {
  const title = value.replace(/\s+/g, " ").trim();
  return (title || fallback).slice(0, 160);
}

function normalizeKeywords(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(new Set(
    value
      .map((item) => {
        if (typeof item === "string") return item;
        const keyword = item && typeof item === "object"
          ? (item as KeywordInput).simplifiedChinese
          : "";
        return String(keyword || "");
      })
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean),
  )).slice(0, 8);
}

async function runWebSearch(
  openai: OpenAI,
  platform: ChinaPlatform,
  translatedProductName: string,
  keywords: string[],
  limit: number,
) {
  const config = platformConfig[platform];
  const chineseQuery = Array.from(
    new Set([translatedProductName, ...keywords].filter(Boolean)),
  ).slice(0, 6).join(" / ");

  const input = [
    `중국어 검색어: ${chineseQuery}`,
    `검색 대상: ${config.label}`,
    `공개 웹에 색인된 ${config.label}의 개별 세로형 쇼츠·영상 노트·상품 사용 장면 페이지를 최대 ${limit}개 찾으세요.`,
    "상품 사용, 문제 해결, 전후 비교, 후기형 짧은 콘텐츠를 우선하세요.",
    "홈, 로그인, 검색결과, 사용자 프로필보다 개별 콘텐츠 페이지를 우선하세요.",
    "조회수·판매량·인기 순위를 추정하거나 만들지 마세요.",
    "각 후보를 짧은 제목 목록으로 쓰고 반드시 원문 페이지를 인용하세요.",
  ].join("\n");

  const configuredModel = String(process.env.OPENAI_WEB_SEARCH_MODEL || "").trim();
  const modelCandidates = Array.from(
    new Set([configuredModel, "gpt-5"].filter(Boolean)),
  );

  let lastError: unknown = null;

  for (const model of modelCandidates) {
    try {
      return await openai.responses.create({
        model,
        tools: [{
          type: "web_search",
          filters: { allowed_domains: config.domains },
          search_context_size: "low",
        }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        max_output_tokens: 900,
        input,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${config.label} 공개검색이 응답하지 않았습니다.`);
}

async function searchPlatform(
  openai: OpenAI,
  translatedProductName: string,
  keywords: string[],
  platform: ChinaPlatform,
  limit: number,
) {
  const config = platformConfig[platform];
  const response = await runWebSearch(
    openai,
    platform,
    translatedProductName,
    keywords,
    limit,
  );

  const candidates = new Map<string, SearchCandidate>();

  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type !== "output_text") continue;
      for (const annotation of part.annotations) {
        if (annotation.type !== "url_citation") continue;
        const detectedPlatform = platformForUrl(annotation.url);
        if (detectedPlatform !== platform || candidates.has(annotation.url)) continue;
        candidates.set(annotation.url, {
          platform,
          url: annotation.url,
          title: cleanTitle(
            annotation.title,
            `${config.label} 공개 콘텐츠`,
          ),
          sourceRank: candidates.size + 1,
        });
      }
    }
  }

  return Array.from(candidates.values()).slice(0, limit);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      query?: unknown;
      translatedProductName?: unknown;
      keywords?: unknown;
      platform?: unknown;
      limit?: unknown;
    };

    const query = String(body.query || "").replace(/\s+/g, " ").trim();
    const translatedProductName = String(
      body.translatedProductName || query,
    ).replace(/\s+/g, " ").trim();
    const keywords = normalizeKeywords(body.keywords);
    const platform = (["all", "douyin", "xiaohongshu"] as const)
      .includes(body.platform as SearchPlatform)
      ? body.platform as SearchPlatform
      : "all";
    const totalLimit = Math.max(
      4,
      Math.min(12, Math.round(Number(body.limit) || 12)),
    );

    if (query.length < 2 || translatedProductName.length < 2) {
      return NextResponse.json({
        success: false,
        message: "검색어를 두 글자 이상 입력해주세요.",
      }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        query,
        translatedProductName,
        results: [],
        failedPlatforms: [],
        skipped: true,
        message: "OPENAI_API_KEY가 없어 공개검색은 건너뛰었습니다. Edge 로그인 검색은 계속됩니다.",
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const platforms: ChinaPlatform[] = platform === "all"
      ? ["douyin", "xiaohongshu"]
      : [platform];
    const perPlatformLimit = platform === "all"
      ? Math.ceil(totalLimit / 2)
      : totalLimit;

    const settled = await Promise.allSettled(
      platforms.map((item) => searchPlatform(
        openai,
        translatedProductName,
        keywords,
        item,
        perPlatformLimit,
      )),
    );

    const candidates = settled.flatMap((result) => (
      result.status === "fulfilled" ? result.value : []
    ));
    const failedPlatforms = settled.flatMap((result, index) => (
      result.status === "rejected" ? [platforms[index]] : []
    ));
    const uniqueCandidates = Array.from(
      new Map(candidates.map((item) => [item.url, item])).values(),
    ).slice(0, totalLimit);

    const metadata = await Promise.all(
      uniqueCandidates.map((item) => publicReferenceMetadata(item.url)),
    );

    const results = uniqueCandidates.map((item, index) => {
      const fallbackTitle = `${platformConfig[item.platform].label} 공개 콘텐츠`;
      const engagement = metadata[index]?.engagement
        || { likes: null, comments: null, saves: null };
      const verifiedLikes = typeof engagement.likes === "number"
        ? engagement.likes
        : null;

      return {
        id: `china-lab-public-${item.platform}-${index}-${Buffer.from(item.url).toString("base64url").slice(0, 16)}`,
        platform: item.platform,
        title: cleanTitle(
          item.title || metadata[index]?.title || fallbackTitle,
          fallbackTitle,
        ),
        url: item.url,
        thumbnailUrl: metadata[index]?.thumbnailUrl || "",
        durationSeconds: metadata[index]?.durationSeconds ?? null,
        engagement,
        popularityLabel: verifiedLikes === null
          ? `공개검색 상위 ${item.sourceRank}`
          : `공개 좋아요 ${verifiedLikes.toLocaleString("ko-KR")}`,
        note: `${query} 관련 공개 웹 색인 결과 · 원본 파일 아님`,
        rightsStatus: "unverified" as const,
        canUseOriginal: false as const,
        sourceLabel: "중국 영상 연구소 공개검색",
        sourceMode: "public-index" as const,
        nativeRank: item.sourceRank,
      };
    })
      .filter((item) => item.durationSeconds === null || item.durationSeconds <= 60)
      .slice(0, totalLimit);

    return NextResponse.json({
      success: true,
      query,
      translatedProductName,
      results,
      failedPlatforms,
      searchedAt: new Date().toISOString(),
      message: results.length
        ? `중국어 \"${translatedProductName}\"로 공개 영상 카드 ${results.length}개를 찾았습니다.${failedPlatforms.length ? " 일부 플랫폼은 응답하지 않았습니다." : ""}`
        : `중국어 \"${translatedProductName}\"로 공개검색했지만 색인된 개별 영상이 없었습니다. Edge 로그인 검색 결과를 확인해주세요.${failedPlatforms.length ? " 일부 플랫폼은 응답하지 않았습니다." : ""}`,
    });
  } catch (error) {
    return NextResponse.json({
      success: true,
      results: [],
      failedPlatforms: [],
      warning: true,
      message: error instanceof Error
        ? `공개검색 확인 필요: ${error.message} Edge 로그인 검색은 계속됩니다.`
        : "공개검색은 응답하지 않았지만 Edge 로그인 검색은 계속됩니다.",
    });
  }
}
