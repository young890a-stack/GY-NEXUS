import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishToWebhook, publishToWordPress } from "@/lib/publishing/publish";
import { publishToBlogger } from "@/lib/publishing/blogger";
import { publishVideoToYouTube } from "@/lib/publishing/youtube";
import { createNaverPublishPackage } from "@/lib/publishing/naver";
import { CONNECTION_COOKIE_OPTIONS, decryptConnectionValue, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";
type PublishResult = { success: boolean; externalId?: string; url?: string; message: string; token?: OAuthToken; payload?: Record<string, unknown> };
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})); const limit = Math.min(20, Math.max(1, Number(body.limit || 10)));
    const supabase = await createClient(); const { data: jobs, error } = await supabase.from("publishing_jobs").select("*").in("status", ["queued", "retry"]).lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(limit); if (error) throw error;
    let bloggerToken = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_blogger_token")?.value);
    let youtubeToken = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_youtube_token")?.value);
    let refreshedBloggerToken: OAuthToken | undefined; let refreshedYoutubeToken: OAuthToken | undefined;
    const results: Array<{ id: string; success: boolean; message: string; externalId?: string; url?: string }> = [];
    for (const job of jobs || []) {
      if (Number(job.attempts || 0) >= Number(job.max_attempts || 3)) { await supabase.from("publishing_jobs").update({ status: "cancelled", last_error: "최대 재시도 횟수를 초과했습니다.", updated_at: new Date().toISOString() }).eq("id", job.id); results.push({ id: job.id, success: false, message: "최대 재시도 횟수 초과" }); continue; }
      await supabase.from("publishing_jobs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", job.id);
      const payload = (job.payload || {}) as { isDraft?: boolean; labels?: string[]; videoUrl?: string; thumbnailUrl?: string; tags?: string[]; privacyStatus?: "private"|"unlisted"|"public"; publishAt?: string; imageUrls?: string[]; sourceUrl?: string };
      let result: PublishResult;
      if (job.channel === "blogger") {
        result = bloggerToken?.access_token ? await publishToBlogger({ token: bloggerToken, title: job.title, content: job.content, labels: payload.labels || payload.tags, isDraft: Boolean(payload.isDraft) }) : { success: false, message: "Blogger 계정을 통합 연결센터에서 먼저 연결해주세요." };
        if (result.token) { bloggerToken = result.token; refreshedBloggerToken = result.token; }
      } else if (job.channel === "youtube") {
        if (!youtubeToken?.access_token) result = { success: false, message: "YouTube 계정을 통합 연결센터에서 먼저 연결해주세요." };
        else if (!payload.videoUrl) result = { success: false, message: "YouTube 게시에는 완성 영상 URL이 필요합니다." };
        else result = await publishVideoToYouTube({ token: youtubeToken, videoUrl: payload.videoUrl, thumbnailUrl: payload.thumbnailUrl, title: job.title, description: job.content, tags: payload.tags, privacyStatus: payload.privacyStatus, publishAt: payload.publishAt });
        if (result.token) { youtubeToken = result.token; refreshedYoutubeToken = result.token; }
      } else if (job.channel === "naver") {
        const pack = createNaverPublishPackage({ title: job.title, content: job.content, tags: payload.tags, imageUrls: payload.imageUrls, sourceUrl: payload.sourceUrl });
        result = { success: true, externalId: `naver-package-${job.id}`, url: pack.shareUrl, message: "네이버 게시 패키지 준비 완료", payload: { naverPackage: pack } };
      } else if (job.channel === "wordpress") result = await publishToWordPress({ title: job.title, content: job.content });
      else result = await publishToWebhook({ title: job.title, content: job.content, channel: job.channel });
      const nextPayload = { ...(job.payload || {}), ...(result.payload || {}), resultUrl: result.url || null, resultMessage: result.message };
      await supabase.from("publishing_jobs").update({ status: result.success ? "published" : "retry", external_id: result.externalId || null, last_error: result.success ? null : result.message, attempts: Number(job.attempts || 0) + 1, published_at: result.success ? new Date().toISOString() : null, updated_at: new Date().toISOString(), payload: nextPayload }).eq("id", job.id);
      results.push({ id: job.id, success: result.success, message: result.message, externalId: result.externalId, url: result.url });
    }
    const response = NextResponse.json({ success: true, processed: results.length, results });
    if (refreshedBloggerToken) response.cookies.set("gy_blogger_token", encryptConnectionValue(refreshedBloggerToken), CONNECTION_COOKIE_OPTIONS);
    if (refreshedYoutubeToken) response.cookies.set("gy_youtube_token", encryptConnectionValue(refreshedYoutubeToken), CONNECTION_COOKIE_OPTIONS);
    return response;
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "게시 실행 실패" }, { status: 500 }); }
}
