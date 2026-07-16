import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planScenes } from "@/lib/creative-studio-pro/planner";
import type { ProProjectInput } from "@/lib/creative-studio-pro/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await createAdminClient().from("video_projects").select("id,title,product_name,duration_seconds,ratio,style,status,final_video_url,created_at,updated_at").order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    return NextResponse.json({ success: true, projects: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, projects: [], message: error instanceof Error ? error.message : "프로젝트를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as ProProjectInput;
    if (!input.title?.trim() || !input.productName?.trim()) return NextResponse.json({ success: false, message: "작업명과 상품명을 입력해주세요." }, { status: 400 });
    if (![20,25,30].includes(input.duration)) return NextResponse.json({ success: false, message: "영상 길이는 20초, 25초, 30초 중에서 선택해주세요." }, { status: 400 });

    const supabase = createAdminClient();
    const scenes = planScenes(input);
    const { data: project, error } = await supabase.from("video_projects").insert({
      title: input.title.trim(), product_name: input.productName.trim(), product_description: input.productDescription?.trim() || "",
      master_prompt: input.masterPrompt?.trim() || "", source_image_url: input.sourceImageUrl?.trim() || null,
      duration_seconds: input.duration, ratio: input.ratio, style: input.style, subtitle_mode: input.subtitleMode,
      voice_mode: input.voiceMode, music_mood: input.musicMood || "clean-corporate", status: "planned", scene_count: scenes.length,
      settings: input,
    }).select("*").single();
    if (error || !project) throw error || new Error("프로젝트 저장 실패");

    const rows = scenes.map((scene) => ({
      project_id: project.id, scene_number: scene.sceneNumber, start_second: scene.startSecond, end_second: scene.endSecond,
      duration_seconds: scene.duration, role: scene.role, prompt: scene.prompt, narration: scene.narration,
      subtitle_text: scene.subtitle, status: "pending",
    }));
    const { error: sceneError } = await supabase.from("video_scenes").insert(rows);
    if (sceneError) throw sceneError;
    return NextResponse.json({ success: true, project, scenes });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "프로젝트 생성에 실패했습니다." }, { status: 500 });
  }
}
