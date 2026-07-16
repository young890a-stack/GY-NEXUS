import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishToWebhook, publishToWordPress } from "@/lib/publishing/publish";
import { publishToBlogger } from "@/lib/publishing/blogger";
import { CONNECTION_COOKIE_OPTIONS, decryptConnectionValue, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";

type PublishResult = { success: boolean; externalId?: string; url?: string; message: string; token?: OAuthToken };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(20, Math.max(1, Number(body.limit || 5)));
    const supabase = await createClient();
    const { data: jobs, error } = await supabase
      .from("publishing_jobs")
      .select("*")
      .in("status", ["queued", "retry"])
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(limit);
    if (error) throw error;

    let bloggerToken = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_blogger_token")?.value);
    let refreshedBloggerToken: OAuthToken | undefined;
    const results: Array<{ id: string; success: boolean; message: string; externalId?: string; url?: string }> = [];

    for (const job of jobs || []) {
      if (Number(job.attempts || 0) >= Number(job.max_attempts || 3)) {
        await supabase.from("publishing_jobs").update({
          status: "cancelled",
          last_error: "최대 재시도 횟수를 초과했습니다.",
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        results.push({ id: job.id, success: false, message: "최대 재시도 횟수 초과" });
        continue;
      }

      await supabase.from("publishing_jobs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", job.id);

      let result: PublishResult;
      if (job.channel === "wordpress") {
        result = await publishToWordPress({ title: job.title, content: job.content });
      } else if (job.channel === "blogger") {
        if (!bloggerToken?.access_token) {
          result = { success: false, message: "Blogger 계정을 먼저 외부 채널 연결센터에서 연결해주세요." };
        } else {
          const payload = (job.payload || {}) as { isDraft?: boolean };
          result = await publishToBlogger({ token: bloggerToken, title: job.title, content: job.content, isDraft: Boolean(payload.isDraft) });
          if (result.token) {
            bloggerToken = result.token;
            refreshedBloggerToken = result.token;
          }
        }
      } else {
        result = await publishToWebhook({ title: job.title, content: job.content, channel: job.channel });
      }

      await supabase.from("publishing_jobs").update({
        status: result.success ? "published" : "retry",
        external_id: result.externalId || null,
        last_error: result.success ? null : result.message,
        attempts: Number(job.attempts || 0) + 1,
        published_at: result.success ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        payload: { ...(job.payload || {}), resultUrl: result.url || null },
      }).eq("id", job.id);
      results.push({ id: job.id, success: result.success, message: result.message, externalId: result.externalId, url: result.url });
    }

    const response = NextResponse.json({ success: true, processed: results.length, results });
    if (refreshedBloggerToken) {
      response.cookies.set("gy_blogger_token", encryptConnectionValue(refreshedBloggerToken), CONNECTION_COOKIE_OPTIONS);
    }
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "게시 실행 실패" }, { status: 500 });
  }
}
