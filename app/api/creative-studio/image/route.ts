import { NextResponse } from "next/server";
import { generateCreativeImage } from "@/lib/creative-studio/image";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ImageRequest } from "@/lib/creative-studio/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let jobId: string | null = null;
  try {
    const body = await request.json() as ImageRequest;
    if (!body.title?.trim() || !body.prompt?.trim()) return NextResponse.json({ success: false, message: "제목과 이미지 프롬프트를 입력해주세요." }, { status: 400 });
    const supabase = createAdminClient();
    const { data } = await supabase.from("creative_jobs").insert({ job_type: "image", title: body.title, prompt: body.prompt, input_data: body, status: "processing", provider: "openai" }).select("id").single();
    jobId = data?.id || null;
    const result = await generateCreativeImage(body);
    if (jobId) await supabase.from("creative_jobs").update({ status: "completed", output_data: result, asset_url: result.assetUrl, completed_at: new Date().toISOString() }).eq("id", jobId);
    return NextResponse.json({ success: true, result, jobId });
  } catch (error) {
    console.error("CREATIVE IMAGE ERROR", error);
    try { if (jobId) await createAdminClient().from("creative_jobs").update({ status: "failed", error_message: error instanceof Error ? error.message : String(error) }).eq("id", jobId); } catch {}
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "이미지 생성에 실패했습니다." }, { status: 500 });
  }
}
