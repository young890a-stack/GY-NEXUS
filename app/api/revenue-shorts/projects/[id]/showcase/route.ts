import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();

    if (!isOwner(user)) {
      return NextResponse.json({ success: false, message: "대표 관리자만 영상을 공개할 수 있습니다." }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json() as {
      publish?: boolean;
      title?: unknown;
      description?: unknown;
      affiliateUrl?: unknown;
      posterUrl?: unknown;
    };

    const publish = body.publish === true;
    const supabase = createAdminClient();
    const { data: project, error } = await supabase
      .from("video_projects")
      .select("id,final_video_url,source_image_url,settings")
      .eq("id", id)
      .single();

    if (error || !project) throw error || new Error("영상 프로젝트를 찾을 수 없습니다.");
    if (publish && !project.final_video_url) {
      return NextResponse.json({ success: false, message: "완성 MP4가 있어야 사이트에 공개할 수 있습니다." }, { status: 400 });
    }

    const settings = record(project.settings);
    const now = new Date().toISOString();
    const nextSettings = {
      ...settings,
      publicShowcase: publish,
      showcaseTitle: optionalText(body.title) || optionalText(settings.showcaseTitle),
      showcaseDescription: optionalText(body.description) || optionalText(settings.showcaseDescription),
      showcasePosterUrl: optionalText(body.posterUrl) || optionalText(settings.showcasePosterUrl) || optionalText(project.source_image_url),
      affiliateUrl: optionalText(body.affiliateUrl) || optionalText(settings.affiliateUrl),
      showcasePublishedAt: publish ? optionalText(settings.showcasePublishedAt) || now : null,
      showcaseUpdatedAt: now,
    };

    const { error: updateError } = await supabase
      .from("video_projects")
      .update({ settings: nextSettings, updated_at: now })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      publicShowcase: publish,
      message: publish
        ? "완성 영상을 사이트 메인·영상 포트폴리오·상품 판매 화면에 공개했습니다."
        : "사이트 영상 공개를 해제했습니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "영상 공개 상태 변경에 실패했습니다.",
    }, { status: 500 });
  }
}
