import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStorageSegment } from "@/lib/creative-studio/storage";

export const runtime = "nodejs";

function srtTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},000`;
}

function createSrt(scenes: Array<Record<string, unknown>>) {
  return scenes
    .filter((scene) => String(scene.subtitle_text || "").trim())
    .map((scene, index) => [
      index + 1,
      `${srtTime(Number(scene.start_second))} --> ${srtTime(Number(scene.end_second))}`,
      String(scene.subtitle_text).trim(),
    ].join("\n"))
    .join("\n\n") + "\n";
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const format = new URL(request.url).searchParams.get("format") || "manifest";
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const { data: scenes, error: sceneError } = await supabase.from("video_scenes").select("*").eq("project_id", id).order("scene_number");
    if (sceneError) throw sceneError;

    const safeName = safeStorageSegment(project.title, "gy-shorts-project");
    if (format === "srt") {
      return new Response(createSrt((scenes || []) as Array<Record<string, unknown>>), {
        headers: {
          "Content-Type": "application/x-subrip; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}.srt"`,
        },
      });
    }

    if (format === "guide") {
      const guide = [
        "GY-NEXUS · CAPCUT 마무리 가이드",
        "",
        `프로젝트: ${project.title}`,
        `화면: ${project.ratio === "720:1280" ? "9:16 세로" : "16:9 가로"}`,
        `총 길이: ${project.duration_seconds}초`,
        "",
        "1. 장면 번호 순서대로 MP4 클립을 CapCut 타임라인에 넣습니다.",
        "2. 자동 자막을 실행하지 말고 함께 받은 SRT 자막을 가져옵니다.",
        "3. 상품 색상이나 형태가 바뀌는 AI 효과는 추가하지 않습니다.",
        "4. 전환은 0.15~0.30초의 짧은 디졸브 또는 컷을 사용합니다.",
        "5. 효과음과 음악은 음성보다 낮게 맞추고 최종 상품 사실을 다시 확인합니다.",
        "",
        "장면 목록",
        ...(scenes || []).map((scene) => `${scene.scene_number}. ${scene.start_second}–${scene.end_second}초 · ${scene.role}\n   자막: ${scene.subtitle_text || "없음"}\n   클립: ${scene.video_url || "아직 생성되지 않음"}`),
      ].join("\n");
      return new Response(guide, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}-capcut-guide.txt"`,
        },
      });
    }

    const manifest = {
      version: "GY-SHORTS-QUALITY-1.0",
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        title: project.title,
        productName: project.product_name,
        productUrl: project.settings?.productUrl || null,
        durationSeconds: project.duration_seconds,
        ratio: project.ratio,
        style: project.style,
        finalVideoUrl: project.final_video_url || null,
        referenceImageUrls: project.reference_image_urls || [],
        qualityThreshold: project.quality_threshold,
      },
      scenes: (scenes || []).map((scene) => ({
        number: scene.scene_number,
        startSecond: scene.start_second,
        endSecond: scene.end_second,
        role: scene.role,
        subtitle: scene.subtitle_text,
        narration: scene.narration,
        imageUrl: scene.selected_image_url,
        imageQualityScore: scene.quality_score,
        clipUrl: scene.video_url,
      })),
    };
    return new NextResponse(JSON.stringify(manifest, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}-edit-manifest.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "편집팩 내보내기에 실패했습니다." },
      { status: 500 },
    );
  }
}
