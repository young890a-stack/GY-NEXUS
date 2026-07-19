import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStorageSegment } from "@/lib/creative-studio/storage";
import { normalizeMediaReferences } from "@/lib/creative-studio-pro/integration";

export const runtime = "nodejs";

function srtTime(seconds: number) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const whole = Math.floor(milliseconds / 1000);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
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

function createCommerceSrt(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map((item, index) => {
    const cue = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
    return [
      index + 1,
      `${srtTime(Number(cue.startSecond))} --> ${srtTime(Number(cue.endSecond))}`,
      String(cue.text || "").trim(),
    ].join("\n");
  }).filter((block) => block.trim()).join("\n\n") + "\n";
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
    const settings = project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? project.settings as Record<string, unknown>
      : {};
    const mediaReferences = normalizeMediaReferences(settings.mediaReferences);
    if (format === "srt") {
      const commerce = settings.commercePackage && typeof settings.commercePackage === "object" && !Array.isArray(settings.commercePackage)
        ? settings.commercePackage as Record<string, unknown>
        : {};
      const exactSrt = createCommerceSrt(commerce.subtitleCues);
      return new Response(exactSrt.trim() ? exactSrt : createSrt((scenes || []) as Array<Record<string, unknown>>), {
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
        "4. 허가된 원본 영상 컷은 0.7~2.5초 범위로 사용하고, 권리 미확인 자료는 절대 넣지 않습니다.",
        "5. 전환은 0.15~0.30초의 짧은 디졸브 또는 컷을 사용합니다.",
        "6. 효과음과 음악은 음성보다 낮게 맞추고 최종 상품 사실을 다시 확인합니다.",
        "7. 게시 전 훅·상품 일치·허위 표현·자막·제휴 고지를 다시 확인합니다.",
        "",
        "최종 사용 허가 소재",
        ...mediaReferences.filter((item) => item.useInFinal).map((item) => `- ${item.title || item.url} · ${item.rightsStatus} · ${item.url}`),
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

    if (format === "package") {
      const commerce = settings.commercePackage as Record<string, unknown> | undefined;
      if (!commerce) {
        return NextResponse.json({ success: false, message: "먼저 판매 패키지를 생성해주세요." }, { status: 400 });
      }
      const packageText = [
        "GY-NEXUS · 쇼핑 쇼츠 게시 패키지",
        "",
        `상품: ${project.product_name}`,
        `GY 진열장 상품번호: ${String(commerce.productCode || settings.gyProductCode || "미생성")}`,
        `제목: ${commerce.title || project.title}`,
        "",
        "[첫 2초 훅]",
        ...(Array.isArray(commerce.hookOptions) ? commerce.hookOptions.map((hook: unknown, index: number) => `${index + 1}. ${String(hook)}`) : []),
        "",
        "[전체 대본]",
        String(commerce.voiceover || ""),
        "",
        "[영상 설명]",
        String(commerce.description || ""),
        "",
        "[CTA]",
        String(commerce.cta || ""),
        "",
        "[제휴 고지]",
        String(commerce.disclosure || ""),
        "",
        "[해시태그]",
        Array.isArray(commerce.hashtags) ? commerce.hashtags.map(String).join(" ") : "",
        "",
        "[썸네일 3안]",
        ...(Array.isArray(commerce.thumbnailOptions) ? commerce.thumbnailOptions.map((item: Record<string, unknown>, index: number) => `${index + 1}. ${String(item.headline || "")} / ${String(item.accent || "")}`) : []),
        "",
        "",
        "[플랫폼별 패키지]",
        JSON.stringify(commerce.platformVersions || {}, null, 2),
        "",
        `제휴 링크: ${settings.affiliateUrl || "미연결"}`,
        `AI 음성: ${settings.voiceAudioUrl || "미생성"}`,
        `대표 승인: ${settings.contentApprovedAt || "미승인"}`,
      ].join("\n");
      return new Response(packageText, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}-publish-package.txt"`,
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
        productUrl: settings.productUrl || null,
        durationSeconds: project.duration_seconds,
        ratio: project.ratio,
        style: project.style,
        finalVideoUrl: project.final_video_url || null,
        sourceMode: settings.sourceMode || "premium-multi-photo",
        affiliateUrl: settings.affiliateUrl || null,
        gyProductCode: settings.gyProductCode || null,
        subtitleStyle: settings.subtitleStyle || "bold-pop",
        thumbnailStyle: settings.thumbnailStyle || "benefit-arrow",
        sfxMode: settings.sfxMode || "recommended",
        commercePackage: settings.commercePackage || null,
        voiceAudioUrl: settings.voiceAudioUrl || null,
        trendIntelligence: settings.trendIntelligence || null,
        contentApproval: {
          approvedAt: settings.contentApprovedAt || null,
          selectedHookIndex: settings.selectedHookIndex ?? null,
          checklist: settings.contentApprovalChecklist || null,
        },
        mediaReferences,
        licensedFinalAssets: mediaReferences.filter((item) => item.useInFinal && item.rightsStatus !== "unverified"),
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
