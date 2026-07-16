import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 이전 버전의 원터치 버튼 호환용: Sprint 6 작업 큐에 새 작업을 등록합니다.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const supabase = await createClient();
    const config = {
      generateImage: true,
      generateVideo: Boolean(body.generateVideo),
      publishBlogger: body.channel === "blogger" && Boolean(body.autoPublish),
      publishYouTube: false,
      publishWordPress: body.channel === "wordpress" && Boolean(body.autoPublish),
      publishWebhook: body.channel === "webhook" && Boolean(body.autoPublish),
      bloggerDraft: true,
      youtubePrivacy: "private",
    };
    const { data, error } = await supabase.from("automation_jobs").insert({
      status: "queued", current_step: "queued", config, result_data: {}, attempts: 0, max_attempts: 3,
      scheduled_at: new Date().toISOString(),
    }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ success: true, product: "자동 선택", jobId: data.id, message: "Sprint 6 작업 큐에 등록했습니다." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "자동화 등록 실패" }, { status: 500 });
  }
}
