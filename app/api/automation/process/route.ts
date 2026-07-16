import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processAutomationJob } from "@/lib/automation/engine";
import { CONNECTION_COOKIE_OPTIONS, decryptConnectionValue, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { jobId?: string; limit?: number };
    const limit = Math.min(5, Math.max(1, Number(body.limit || 1)));
    const supabase = await createClient();
    let query = supabase
      .from("automation_jobs")
      .select("*")
      .in("status", ["queued", "retry"])
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(limit);
    if (body.jobId) query = query.eq("id", body.jobId);
    const { data: jobs, error } = await query;
    if (error) throw error;
    if (!jobs?.length) return NextResponse.json({ success: true, processed: 0, message: "실행 가능한 대기 작업이 없습니다." });

    let bloggerToken = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_blogger_token")?.value);
    let youtubeToken = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_youtube_token")?.value);
    const results: Array<{ id: string; success: boolean; message: string }> = [];

    for (const job of jobs) {
      try {
        const output = await processAutomationJob({
          supabase,
          job,
          tokens: { blogger: bloggerToken, youtube: youtubeToken },
        });
        if (output.tokenUpdates.blogger) bloggerToken = output.tokenUpdates.blogger;
        if (output.tokenUpdates.youtube) youtubeToken = output.tokenUpdates.youtube;
        results.push({ id: job.id, success: true, message: "전체 워크플로우 완료" });
      } catch (jobError) {
        results.push({ id: job.id, success: false, message: jobError instanceof Error ? jobError.message : "자동화 실패" });
      }
    }

    const response = NextResponse.json({ success: true, processed: results.length, results });
    if (bloggerToken) response.cookies.set("gy_blogger_token", encryptConnectionValue(bloggerToken), CONNECTION_COOKIE_OPTIONS);
    if (youtubeToken) response.cookies.set("gy_youtube_token", encryptConnectionValue(youtubeToken), CONNECTION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "작업 큐 실행 실패" }, { status: 500 });
  }
}
