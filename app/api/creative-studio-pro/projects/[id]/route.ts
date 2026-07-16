import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (error) throw error;
    const { data: scenes, error: sceneError } = await supabase.from("video_scenes").select("*").eq("project_id", id).order("scene_number");
    if (sceneError) throw sceneError;
    return NextResponse.json({ success: true, project, scenes: scenes || [] });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "프로젝트 조회 실패" }, { status: 500 }); }
}
