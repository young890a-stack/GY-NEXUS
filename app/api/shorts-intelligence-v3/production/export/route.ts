import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSrtTime } from "@/lib/shorts-intelligence-v3/production-v34";

export const runtime = "nodejs";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const variantId = String(url.searchParams.get("variantId") || "").trim();
    if (!variantId) return NextResponse.json({ success: false, message: "variantId가 필요합니다." }, { status: 400 });
    const supabase = createAdminClient();
    const { data: variant, error: variantError } = await supabase.from("shorts_production_variants_v34").select("id,variant_key,title,video_project_id").eq("id", variantId).single();
    if (variantError || !variant || !variant.video_project_id) throw variantError || new Error("제작안을 찾지 못했습니다.");
    const { data: project, error: projectError } = await supabase.from("video_projects").select("settings").eq("id", variant.video_project_id).single();
    if (projectError || !project) throw projectError || new Error("영상 프로젝트를 찾지 못했습니다.");
    const settings = record(project.settings);
    const commerce = record(settings.commercePackage);
    const cues = Array.isArray(commerce.subtitleCues) ? commerce.subtitleCues.map(record) : [];
    if (!cues.length) throw new Error("먼저 콘텐츠 승인으로 정확한 SRT 자막을 확정해주세요.");
    const srt = cues.map((cue, index) => [
      String(index + 1),
      `${formatSrtTime(Number(cue.startSecond))} --> ${formatSrtTime(Number(cue.endSecond))}`,
      String(cue.text || "").trim(),
      "",
    ].join("\n")).join("\n");
    const safeName = `${variant.variant_key}-${variant.title}`.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 70) || `v34-${variant.variant_key}`;
    return new Response(srt, {
      status: 200,
      headers: {
        "Content-Type": "application/x-subrip; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}.srt`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "SRT 내보내기에 실패했습니다." }, { status: 500 });
  }
}
