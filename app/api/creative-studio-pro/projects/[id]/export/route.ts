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

function escapeXml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
    const analyzedReferences = mediaReferences.filter((item) => item.analysis);
    const sourceMixPlan = settings.sourceMixPlan && typeof settings.sourceMixPlan === "object" && !Array.isArray(settings.sourceMixPlan)
      ? settings.sourceMixPlan as Record<string, unknown>
      : null;
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

    if (format === "thumbnail") {
      const commerce = settings.commercePackage && typeof settings.commercePackage === "object" && !Array.isArray(settings.commercePackage)
        ? settings.commercePackage as Record<string, unknown>
        : {};
      const options = Array.isArray(commerce.thumbnailOptions) ? commerce.thumbnailOptions : [];
      if (!options.length) return NextResponse.json({ success: false, message: "먼저 판매 패키지를 생성해주세요." }, { status: 400 });
      const requestedIndex = Math.max(0, Math.min(options.length - 1, Number(new URL(request.url).searchParams.get("index") || 0)));
      const option = options[requestedIndex] && typeof options[requestedIndex] === "object"
        ? options[requestedIndex] as Record<string, unknown>
        : {};
      const vertical = project.ratio === "720:1280";
      const width = vertical ? 1080 : 1280;
      const height = vertical ? 1920 : 720;
      const imageUrl = Array.isArray(project.reference_image_urls) && project.reference_image_urls[0]
        ? String(project.reference_image_urls[0])
        : String(project.source_image_url || "");
      const panelY = Math.round(height * .67);
      const headlineSize = vertical ? 82 : 66;
      const accentSize = vertical ? 46 : 36;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dbeafe"/><stop offset=".5" stop-color="#ede9fe"/><stop offset="1" stop-color="#fdf2f8"/></linearGradient><linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f172a" stop-opacity=".96"/><stop offset="1" stop-color="#312e81" stop-opacity=".94"/></linearGradient></defs>
<rect width="${width}" height="${height}" rx="40" fill="url(#bg)"/>
${imageUrl ? `<image href="${escapeXml(imageUrl)}" x="${Math.round(width * .08)}" y="${Math.round(height * .06)}" width="${Math.round(width * .84)}" height="${Math.round(height * .62)}" preserveAspectRatio="xMidYMid meet"/>` : ""}
<rect x="${Math.round(width * .05)}" y="${panelY}" width="${Math.round(width * .9)}" height="${Math.round(height * .27)}" rx="34" fill="url(#panel)"/>
<text x="${width / 2}" y="${panelY + Math.round(height * .09)}" text-anchor="middle" fill="#ffffff" font-family="Pretendard, Noto Sans KR, sans-serif" font-size="${headlineSize}" font-weight="900">${escapeXml(option.headline)}</text>
<text x="${width / 2}" y="${panelY + Math.round(height * .17)}" text-anchor="middle" fill="#67e8f9" font-family="Pretendard, Noto Sans KR, sans-serif" font-size="${accentSize}" font-weight="800">${escapeXml(option.accent)}</text>
<text x="${Math.round(width * .08)}" y="${Math.round(height * .965)}" fill="#4338ca" font-family="Arial, sans-serif" font-size="${vertical ? 26 : 20}" font-weight="700">GY-NEXUS · ${escapeXml(project.product_name)}</text>
</svg>`;
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}-thumbnail-${requestedIndex + 1}.svg"`,
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
        "AI 참고영상 분석 · 유지/제거/새로 제작",
        ...analyzedReferences.flatMap((item) => [
          `- ${item.title || item.platform}: ${item.analysis?.sourceSummary || "분석 완료"}`,
          ...(item.analysis?.sceneDecisions || []).map((decision) => `  프레임 ${decision.frameIndex} · ${decision.decision} · ${decision.suggestedDurationSeconds}초 · ${decision.role} · ${decision.reason}`),
        ]),
        "",
        "AI 영상 믹스 설계",
        ...(sourceMixPlan && Array.isArray(sourceMixPlan.cuts)
          ? sourceMixPlan.cuts.map((rawCut) => {
            const cut = rawCut && typeof rawCut === "object" && !Array.isArray(rawCut) ? rawCut as Record<string, unknown> : {};
            return `${cut.order}. ${cut.startSecond}초부터 ${cut.durationSeconds}초 · ${cut.role} · ${cut.decision} · ${cut.direction}`;
          })
          : []),
        ...analyzedReferences.flatMap((item) => (item.analysis?.mixPlan || []).map((shot) => `${shot.order}. ${shot.durationSeconds}초 · ${shot.role} · ${shot.source} · ${shot.direction}`)),
        "",
        `자막 스타일: ${String(settings.subtitleStyle || "bold-pop")}`,
        `배경음악 분위기: ${String(settings.musicMood || "modern-corporate")}`,
        `효과음: ${String(settings.sfxMode || "recommended")}`,
        `한국어 음성: ${String(settings.voiceAudioUrl || "미생성")}`,
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

    const commerce = settings.commercePackage && typeof settings.commercePackage === "object" && !Array.isArray(settings.commercePackage)
      ? settings.commercePackage as Record<string, unknown>
      : {};
    const licensedFinalAssets = mediaReferences.filter((item) => item.useInFinal && item.rightsStatus !== "unverified");
    const editTimeline = (scenes || []).map((scene) => ({
      order: scene.scene_number,
      startSecond: scene.start_second,
      endSecond: scene.end_second,
      durationSeconds: Math.max(0, Number(scene.end_second) - Number(scene.start_second)),
      role: scene.role,
      subtitle: scene.subtitle_text,
      narration: scene.narration,
      imageUrl: scene.selected_image_url,
      imageQualityScore: scene.quality_score,
      clipUrl: scene.video_url,
    }));
    const manifest = {
      version: format === "capcut" ? "GY-CAPCUT-PROJECT-2.0" : "GY-SHORTS-QUALITY-2.0",
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
        sourceMixPlan,
        contentApproval: {
          approvedAt: settings.contentApprovedAt || null,
          selectedHookIndex: settings.selectedHookIndex ?? null,
          checklist: settings.contentApprovalChecklist || null,
        },
        mediaReferences,
        licensedFinalAssets,
        referenceImageUrls: project.reference_image_urls || [],
        qualityThreshold: project.quality_threshold,
      },
      editor: {
        canvas: project.ratio === "720:1280" ? { width: 720, height: 1280, fps: 30 } : { width: 1280, height: 720, fps: 30 },
        timeline: editTimeline,
        subtitleCues: Array.isArray(commerce.subtitleCues) ? commerce.subtitleCues : [],
        subtitleStyle: settings.subtitleStyle || "bold-pop",
        voiceAudioUrl: settings.voiceAudioUrl || null,
        voiceName: settings.voiceName || null,
        musicMood: settings.musicMood || "modern-corporate",
        sfxMode: settings.sfxMode || "recommended",
        thumbnailOptions: Array.isArray(commerce.thumbnailOptions) ? commerce.thumbnailOptions : [],
        licensedAssetUrls: licensedFinalAssets.map((item) => item.url),
        analyzedReferencePlans: analyzedReferences.map((item) => ({
          id: item.id,
          title: item.title,
          rightsStatus: item.rightsStatus,
          mayUseSourceInFinal: item.useInFinal && item.rightsStatus !== "unverified",
          selectedKeywords: item.selectedKeywords,
          sceneDecisions: item.analysis?.sceneDecisions || [],
          mixPlan: item.analysis?.mixPlan || [],
          copyrightSafety: item.analysis?.copyrightSafety || "",
        })),
        selectedSourceMix: sourceMixPlan,
      },
      scenes: editTimeline,
    };
    return new NextResponse(JSON.stringify(manifest, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}-${format === "capcut" ? "capcut-project" : "edit-manifest"}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "편집팩 내보내기에 실패했습니다." },
      { status: 500 },
    );
  }
}
