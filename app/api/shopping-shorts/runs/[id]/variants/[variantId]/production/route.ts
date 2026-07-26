import { NextResponse } from "next/server";
import { AuthorizationError, requireOwner } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    await requireOwner();
    const { id, variantId } = await context.params;
    const body = await request.json() as {
      videoProjectId?: string;
      status?: string;
      finalVideoUrl?: string;
    };
    const status = ["producing", "rendered", "published"].includes(String(body.status))
      ? String(body.status)
      : "producing";
    const supabase = createAdminClient();
    const { data: variant, error: findError } = await supabase
      .from("shopping_shorts_variants")
      .select("id,quality_status")
      .eq("id", variantId)
      .eq("run_id", id)
      .single();
    if (findError || !variant) throw findError || new Error("쇼츠 버전을 찾지 못했습니다.");
    if (variant.quality_status === "blocked") {
      return NextResponse.json({ success: false, message: "품질 기준 미달 버전은 영상으로 제작할 수 없습니다." }, { status: 409 });
    }
    const { error } = await supabase.from("shopping_shorts_variants").update({
      video_project_id: body.videoProjectId || null,
      quality_status: status,
      final_video_url: body.finalVideoUrl || null,
      updated_at: new Date().toISOString(),
    }).eq("id", variantId).eq("run_id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "영상 제작 상태를 연결하지 못했습니다.",
    }, { status: 500 });
  }
}

