import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONNECTION_COOKIE_OPTIONS, decryptConnectionValue, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import { getGoogleCredentials } from "@/lib/connections/oauth-config";
import type { OAuthToken } from "@/lib/connections/types";
import { commerceScore, safeNumber } from "@/lib/growth-commerce/scoring";

export const runtime = "nodejs";
export const maxDuration = 120;

type VideoRow = {
  id: string;
  snippet?: { title?: string; publishedAt?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string } } };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
};

function isoDurationSeconds(value = "") {
  const match = value.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return 0;
  return Math.round((Number(match[1]) * 86400) + (Number(match[2]) * 3600) + (Number(match[3]) * 60) + Number(match[4]));
}

async function refreshToken(token: OAuthToken) {
  const credentials = getGoogleCredentials("youtube");
  if (!credentials || !token.refresh_token) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, refresh_token: token.refresh_token, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = await response.json() as Partial<OAuthToken>;
  if (!data.access_token) return null;
  return { ...token, ...data, refresh_token: token.refresh_token, created_at: Date.now() } as OAuthToken;
}

async function googleJson<T>(url: string, token: OAuthToken) {
  let current = token;
  let response = await fetch(url, { headers: { Authorization: `Bearer ${current.access_token}` }, cache: "no-store" });
  if (response.status === 401) {
    const refreshed = await refreshToken(current);
    if (refreshed) {
      current = refreshed;
      response = await fetch(url, { headers: { Authorization: `Bearer ${current.access_token}` }, cache: "no-store" });
    }
  }
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `YouTube API 오류 (${response.status})`);
  return { data, token: current };
}

function dateOnly(date: Date) { return date.toISOString().slice(0, 10); }

export async function POST(request: NextRequest) {
  try {
    let token = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_youtube_token")?.value);
    if (!token?.access_token) return NextResponse.json({ success: false, message: "통합 연결센터에서 YouTube를 먼저 연결해주세요." }, { status: 401 });

    const channelResult = await googleJson<{ items?: Array<{ id?: string; snippet?: { title?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }> }>(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true", token,
    );
    token = channelResult.token;
    const channel = channelResult.data.items?.[0];
    const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
    if (!channel?.id || !uploads) throw new Error("YouTube 업로드 재생목록을 찾지 못했습니다.");

    const playlistResult = await googleJson<{ items?: Array<{ contentDetails?: { videoId?: string } }> }>(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=50`, token,
    );
    token = playlistResult.token;
    const videoIds = (playlistResult.data.items || []).map((item) => item.contentDetails?.videoId).filter((id): id is string => Boolean(id));
    if (!videoIds.length) return NextResponse.json({ success: true, synced: 0, message: "업로드된 영상이 없습니다." });

    const videosResult = await googleJson<{ items?: VideoRow[] }>(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(",")}`, token,
    );
    token = videosResult.token;

    const start = new Date(); start.setUTCDate(start.getUTCDate() - 90);
    const analyticsParams = new URLSearchParams({
      ids: "channel==MINE",
      startDate: dateOnly(start),
      endDate: dateOnly(new Date()),
      dimensions: "video",
      filters: `video==${videoIds.join(",")}`,
      metrics: "views,engagedViews,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost",
      maxResults: "200",
    });
    let analytics: { columnHeaders?: Array<{ name?: string }>; rows?: unknown[][] } = {};
    try {
      const result = await googleJson<typeof analytics>(`https://youtubeanalytics.googleapis.com/v2/reports?${analyticsParams}`, token);
      analytics = result.data; token = result.token;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/scope|permission|insufficient|forbidden/i.test(message)) {
        throw new Error("YouTube Analytics 권한이 없습니다. 통합 연결센터에서 YouTube 연결을 해제한 뒤 다시 연결해주세요.");
      }
      analyticsParams.set("metrics", "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost");
      const result = await googleJson<typeof analytics>(`https://youtubeanalytics.googleapis.com/v2/reports?${analyticsParams}`, token);
      analytics = result.data; token = result.token;
    }

    const headers = (analytics.columnHeaders || []).map((header) => String(header.name || ""));
    const analyticsMap = new Map<string, Record<string, number>>();
    for (const row of analytics.rows || []) {
      const record: Record<string, number> = {};
      headers.forEach((name, index) => { if (name !== "video") record[name] = safeNumber(row[index]); });
      analyticsMap.set(String(row[headers.indexOf("video")] || ""), record);
    }

    const supabase = createAdminClient();
    const [clickResult, conversionResult] = await Promise.all([
      supabase.from("product_clicks").select("video_id").in("video_id", videoIds),
      supabase.from("commerce_conversions_v35").select("video_id,quantity,revenue").in("video_id", videoIds),
    ]);
    const clicks = new Map<string, number>();
    for (const row of clickResult.data || []) clicks.set(String(row.video_id), (clicks.get(String(row.video_id)) || 0) + 1);
    const conversions = new Map<string, { count: number; revenue: number }>();
    for (const row of conversionResult.data || []) {
      const key = String(row.video_id || ""); const current = conversions.get(key) || { count: 0, revenue: 0 };
      current.count += safeNumber(row.quantity) || 1; current.revenue += safeNumber(row.revenue); conversions.set(key, current);
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
        clicks: clickCount, conversions: conversion.count, revenue: conversion.revenue,
      };
      return {
        channel_id: channel.id,
        channel_title: channel.snippet?.title || "YouTube",
        video_id: video.id,
        title: video.snippet?.title || "",
        published_at: video.snippet?.publishedAt || null,
        thumbnail_url: video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.medium?.url || null,
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
    const { error } = await supabase.from("youtube_video_metrics_v35").upsert(payload, { onConflict: "video_id" });
    if (error) throw error;

    const response = NextResponse.json({ success: true, synced: payload.length, channel: channel.snippet?.title, videos: payload, message: `YouTube 영상 ${payload.length}개의 시청·클릭·판매 지표를 동기화했습니다.` });
    response.cookies.set("gy_youtube_token", encryptConnectionValue(token), CONNECTION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "YouTube 성과 동기화 실패" }, { status: 500 });
  }
}
