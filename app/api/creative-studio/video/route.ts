import { NextResponse } from "next/server";
import { generateCreativeVideo } from "@/lib/creative-studio/video";
import { createAdminClient } from "@/lib/supabase/admin";
import type { VideoRequest } from "@/lib/creative-studio/types";

export const runtime = "nodejs";
export const maxDuration = 800;

export async function POST(request: Request) {
  let jobId: string | null = null;
  try {
    const body = (await request.json()) as VideoRequest;
    body.title = body.title?.trim();
    body.prompt = body.prompt?.trim();
    body.sourceImageUrl = body.sourceImageUrl?.trim() || undefined;

    if (!body.title || !body.prompt) {
      return NextResponse.json(
        { success: false, message: "제목과 영상 프롬프트를 입력해주세요." },
        { status: 400 },
      );
    }
    const supabase = createAdminClient();
    const { data } = await supabase.from("creative_jobs").insert({ job_type: "video", title: body.title, prompt: body.prompt, input_data: body, status: "processing", provider: "runway" }).select("id").single();
    jobId = data?.id || null;
    const result = await generateCreativeVideo(body);
    if (jobId) await supabase.from("creative_jobs").update({ status: "completed", output_data: result, asset_url: result.assetUrl, provider_task_id: result.taskId, completed_at: new Date().toISOString() }).eq("id", jobId);
    return NextResponse.json({ success: true, result, jobId });
  } catch (error) {
    console.error("CREATIVE VIDEO ERROR", error);
    try { if (jobId) await createAdminClient().from("creative_jobs").update({ status: "failed", error_message: error instanceof Error ? error.message : String(error) }).eq("id", jobId); } catch {}
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "영상 생성에 실패했습니다." }, { status: 500 });
  }
}
