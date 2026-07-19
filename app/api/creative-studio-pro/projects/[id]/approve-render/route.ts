import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("id").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");

    const { count } = await supabase
      .from("video_scenes")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .neq("quality_status", "approved");
    if ((count || 0) > 0) {
      return NextResponse.json(
        { success: false, message: "모든 장면 이미지가 품질검수를 통과해야 Runway 비용을 승인할 수 있습니다." },
        { status: 400 },
      );
    }

    const approvedAt = new Date().toISOString();
    const { error: updateError } = await supabase.from("video_projects").update({
      render_approved: true,
      render_approved_at: approvedAt,
      status: "runway_approved",
      updated_at: approvedAt,
    }).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, message: "대표 승인 완료. 이제 검수된 이미지로만 Runway 영상을 생성합니다." });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Runway 비용 승인에 실패했습니다." },
      { status: 500 },
    );
  }
}
