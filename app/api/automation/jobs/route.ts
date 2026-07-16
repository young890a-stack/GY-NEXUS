import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AutomationConfig } from "@/lib/automation/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const [{ data: jobs, error: jobsError }, { data: logs, error: logsError }] = await Promise.all([
      supabase.from("automation_jobs").select("*, products(title)").order("created_at", { ascending: false }).limit(50),
      supabase.from("automation_job_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (jobsError) throw jobsError;
    if (logsError) throw logsError;
    return NextResponse.json({ success: true, jobs: jobs || [], logs: logs || [] });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "자동화 작업 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      productId?: string;
      scheduledAt?: string;
      config?: AutomationConfig;
      runNow?: boolean;
    };
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ success: false, message: "예약 시간이 올바르지 않습니다." }, { status: 400 });
    }
    const config: AutomationConfig = {
      generateImage: body.config?.generateImage !== false,
      generateVideo: Boolean(body.config?.generateVideo),
      publishBlogger: Boolean(body.config?.publishBlogger),
      publishYouTube: Boolean(body.config?.publishYouTube),
      publishWordPress: Boolean(body.config?.publishWordPress),
      publishWebhook: Boolean(body.config?.publishWebhook),
      bloggerDraft: body.config?.bloggerDraft !== false,
      youtubePrivacy: body.config?.youtubePrivacy || "private",
    };
    if (config.publishYouTube && !config.generateVideo) {
      return NextResponse.json({ success: false, message: "YouTube 자동 업로드를 사용하려면 영상 생성을 켜주세요." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.from("automation_jobs").insert({
      product_id: body.productId || null,
      status: "queued",
      current_step: "queued",
      config,
      result_data: {},
      attempts: 0,
      max_attempts: 3,
      scheduled_at: scheduledAt.toISOString(),
    }).select("*").single();
    if (error) throw error;
    await supabase.from("automation_job_logs").insert({
      job_id: data.id,
      step: "queue",
      status: "completed",
      message: body.runNow ? "즉시 실행 작업을 등록했습니다." : "자동화 대기열에 등록했습니다.",
      details: { config },
    });
    return NextResponse.json({ success: true, job: data });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "자동화 작업 생성 실패" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string; action?: "retry" | "cancel" };
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ success: false, message: "작업 ID가 없습니다." }, { status: 400 });
    const supabase = await createClient();
    const update = body.action === "retry"
      ? { status: "retry", current_step: "retry", last_error: null, scheduled_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      : { status: "cancelled", current_step: "cancelled", updated_at: new Date().toISOString() };
    const { error } = await supabase.from("automation_jobs").update(update).eq("id", id);
    if (error) throw error;
    await supabase.from("automation_job_logs").insert({
      job_id: id, step: "queue", status: "completed", message: body.action === "retry" ? "대표가 재시도를 요청했습니다." : "대표가 작업을 취소했습니다.",
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "작업 변경 실패" }, { status: 500 });
  }
}
