import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONNECTION_COOKIE_OPTIONS,
  decryptConnectionValue,
  encryptConnectionValue,
} from "@/lib/connections/secure-cookie";
import { getGoogleCredentials } from "@/lib/connections/oauth-config";
import type { OAuthToken } from "@/lib/connections/types";
import { commerceScore, safeNumber } from "@/lib/growth-commerce/scoring";

export const runtime = "nodejs";
export const maxDuration = 120;

type VideoRow = {
  id: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
};

type ApiError = { code?: string; message?: string; details?: string; hint?: string };

function isoDurationSeconds(value = "") {
  const match = value.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return 0;
  return Math.round(
    Number(match[1] || 0) * 86400 +
      Number(match[2] || 0) * 3600 +
      Number(match[3] || 0) * 60 +
      Number(match[4] || 0),
  );
}

function apiErrorText(error: unknown) {
  if (!error || typeof error !== "object") return String(error || "");
  const row = error as ApiError;
  return [row.code, row.message, row.details, row.hint].filter(Boolean).join(" ");
}

function isSetupError(error: unknown) {
  return /(42P01|42703|PGRST204|PGRST205|does not exist|schema cache|column .* not found|relation .* not found)/i.test(
    apiErrorText(error),
  );
}

async function refreshToken(token: OAuthToken) {
  const credentials = getGoogleCredentials("youtube");
  if (!credentials || !token.refresh_token) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = (await response.json()) as Partial<OAuthToken>;
  if (!data.access_token) return null;
  return { ...token, ...data, refresh_token: token.refresh_token, created_at: Date.now() } as OAuthToken;
}

async function googleJson<T>(url: string, token: OAuthToken) {
  let current = token;
  let response = await fetch(url, {
    headers: { Authorization: `Bearer ${current.access_token}` },
    cache: "no-store",
  });
  if (response.status === 401) {
    const refreshed = await refreshToken(current);
    if (refreshed) {
      current = refreshed;
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${current.access_token}` },
        cache: "no-store",
      });
    }
  }
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || `YouTube API 오류 (${response.status})`);
  return { data, token: current };
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    let token = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_youtube_token")?.value);
    if (!token?.access_token) {
      return NextResponse.json(
        {
          success: false,
          reconnectRequired: true,
          message: "통합 연결센터에서 YouTube 계정을 한 번 연결해주세요.",
        },
        { status: 401 },
      );
    }

    const channelResult = await googleJson<{
      items?: Array<{
        id?: string;
        snippet?: { title?: string };
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }>;
    }>("https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true", token);
    token = channelResult.token;
    const channel = channelResult.data.items?.[0];
    const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
    if (!channel?.id || !uploads) throw new Error("YouTube 업로드 재생목록을 찾지 못했습니다.");

    const playlistResult = await googleJson<{
      items?: Array<{ contentDetails?: { videoId?: string } }>;
    }>(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=50`,
      token,
    );
    token = playlistResult.token;
    const videoIds = (playlistResult.data.items || [])
      .map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));

    if (!videoIds.length) {
      return NextResponse.json({ success: true, synced: 0, persisted: true, message: "업로드된 영상이 없습니다." });
    }

    const videosResult = await googleJson<{ items?: VideoRow[] }>(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(",")}`,
      token,
    );
    token = videosResult.token;

    const warnings: string[] = [];
    let reconnectRequired = false;
    let analytics: { columnHeaders?: Array<{ name?: string }>; rows?: unknown[][] } = {};
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 90);
    const analyticsParams = new URLSearchParams({
      ids: "channel==MINE",
      startDate: dateOnly(start),
      endDate: dateOnly(new Date()),
      dimensions: "video",
      filters: `video==${videoIds.join(",")}`,
      metrics:
        "views,engagedViews,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost",
      maxResults: "200",
    });

    try {
      const result = await googleJson<typeof analytics>(
        `https://youtubeanalytics.googleapis.com/v2/reports?${analyticsParams}`,
        token,
      );
      analytics = result.data;
      token = result.token;
    } catch {
      analyticsParams.set(
        "metrics",
        "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost",
      );
      try {
        const result = await googleJson<typeof analytics>(
          `https://youtubeanalytics.googleapis.com/v2/reports?${analyticsParams}`,
          token,
        );
        analytics = result.data;
        token = result.token;
      } catch {
        reconnectRequired = true;
        warnings.push("YouTube 기본 조회수는 확인했지만 시청 유지율 권한은 아직 없습니다. 나중에 연결센터에서 YouTube를 다시 연결하면 자동으로 보강됩니다.");
      }
    }

    const headers = (analytics.columnHeaders || []).map((header) => String(header.name || ""));
    const analyticsMap = new Map<string, Record<string, number>>();
    const videoHeaderIndex = headers.indexOf("video");
    for (const row of analytics.rows || []) {
      const record: Record<string, number> = {};
      headers.forEach((name, index) => {
        if (name !== "video") record[name] = safeNumber(row[index]);
      });
      if (videoHeaderIndex >= 0) analyticsMap.set(String(row[videoHeaderIndex] || ""), record);
    }

    const supabase = createAdminClient();
    const [clickResult, conversionResult] = await Promise.all([
      supabase.from("product_clicks").select("video_id").in("video_id", videoIds),
      supabase.from("commerce_conversions_v35").select("video_id,quantity,revenue").in("video_id", videoIds),
    ]);

    if (clickResult.error) {
      if (isSetupError(clickResult.error)) warnings.push("판매 클릭 연결은 V3.5 SQL 적용 후 자동 활성화됩니다.");
      else warnings.push("판매 클릭 데이터는 이번 동기화에서 제외했습니다.");
    }
    if (conversionResult.error) {
      if (isSetupError(conversionResult.error)) warnings.push("구매·매출 연결은 V3.5 SQL 적용 후 자동 활성화됩니다.");
      else warnings.push("구매·매출 데이터는 이번 동기화에서 제외했습니다.");
    }

    const clicks = new Map<string, number>();
    for (const row of clickResult.data || []) {
      const key = String(row.video_id || "");
      if (key) clicks.set(key, (clicks.get(key) || 0) + 1);
    }

    const conversions = new Map<string, { count: number; revenue: number }>();
    for (const row of conversionResult.data || []) {
      const key = String(row.video_id || "");
      if (!key) continue;
      const current = conversions.get(key) || { count: 0, revenue: 0 };
      current.count += safeNumber(row.quantity) || 1;
      current.revenue += safeNumber(row.revenue);
      conversions.set(key, current);
    }

    const now = new Date().toISOString();
    const payload = (videosResult.data.items || []).map((video) => {
      const metric = analyticsMap.get(video.id) || {};
      const clickCount = clicks.get(video.id) || 0;
      const conversion = conversions.get(video.id) || { count: 0, revenue: 0 };
      const signal = {
        views: safeNumber(metric.views || video.statistics?.viewCount),
        engagedViews: safeNumber(metric.engagedViews),
        averageViewDuration: safeNumber(metric.averageViewDuration),
        averageViewPercentage: safeNumber(metric.averageViewPercentage),
        likes: safeNumber(metric.likes || video.statistics?.likeCount),
        comments: safeNumber(metric.comments || video.statistics?.commentCount),
        shares: safeNumber(metric.shares),
        subscribersGained: safeNumber(metric.subscribersGained),
        clicks: clickCount,
        conversions: conversion.count,
        revenue: conversion.revenue,
      };
      return {
        channel_id: channel.id,
        channel_title: channel.snippet?.title || "YouTube",
        video_id: video.id,
        title: video.snippet?.title || "",
        published_at: video.snippet?.publishedAt || null,
        thumbnail_url:
          video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.medium?.url || null,
        duration_seconds: isoDurationSeconds(video.contentDetails?.duration),
        views: signal.views,
        engaged_views: signal.engagedViews,
        estimated_minutes_watched: safeNumber(metric.estimatedMinutesWatched),
        average_view_duration: signal.averageViewDuration,
        average_view_percentage: signal.averageViewPercentage,
        likes: signal.likes,
        comments: signal.comments,
        shares: signal.shares,
        subscribers_gained: signal.subscribersGained,
        subscribers_lost: safeNumber(metric.subscribersLost),
        attributed_clicks: clickCount,
        conversions: conversion.count,
        revenue: conversion.revenue,
        commerce_score: commerceScore(signal),
        synced_at: now,
        raw: { apiStatistics: video.statistics || {}, analytics: metric },
      };
    });

    const saveResult = await supabase
      .from("youtube_video_metrics_v35")
      .upsert(payload, { onConflict: "video_id" });

    const setupRequired = Boolean(saveResult.error && isSetupError(saveResult.error));
    if (saveResult.error && !setupRequired) throw saveResult.error;
    if (setupRequired) warnings.push("YouTube 데이터 확인은 성공했습니다. V3.5 SQL이 적용되면 결과가 자동 저장됩니다.");

    const response = NextResponse.json({
      success: true,
      synced: payload.length,
      persisted: !saveResult.error,
      setupRequired,
      reconnectRequired,
      channel: channel.snippet?.title,
      videos: payload,
      warnings,
      message: setupRequired
        ? `YouTube 영상 ${payload.length}개의 기본 성과를 확인했습니다. 저장 기능은 데이터베이스 준비 후 자동 활성화됩니다.`
        : reconnectRequired
          ? `YouTube 영상 ${payload.length}개의 기본 성과를 저장했습니다. 유지율은 계정 재연결 후 자동 보강됩니다.`
          : `YouTube 영상 ${payload.length}개의 시청·클릭·판매 지표를 동기화했습니다.`,
    });
    response.cookies.set("gy_youtube_token", encryptConnectionValue(token), CONNECTION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube 성과 동기화 실패";
    return NextResponse.json(
      {
        success: false,
        message,
        reconnectRequired: /scope|permission|insufficient|forbidden|unauthorized/i.test(message),
      },
      { status: 500 },
    );
  }
}
