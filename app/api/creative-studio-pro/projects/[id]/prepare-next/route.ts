import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  finalizeReferenceImage,
  generateReferenceImageCandidates,
} from "@/lib/creative-studio/image";
import { reviewSceneImageCandidates } from "@/lib/creative-studio-pro/quality";

export const runtime = "nodejs";
export const maxDuration = 300;

function referenceUrls(project: Record<string, unknown>) {
  const stored = Array.isArray(project.reference_image_urls)
    ? project.reference_image_urls.map(String)
    : [];
  const fallback = typeof project.source_image_url === "string" ? [project.source_image_url] : [];
  return Array.from(new Set([...stored, ...fallback].map((value) => value.trim()).filter(Boolean))).slice(0, 4);
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = createAdminClient();
  let sceneId = "";

  try {
    const { data: project, error: projectError } = await supabase
      .from("video_projects")
      .select("*")
      .eq("id", id)
      .single();
    if (projectError || !project) throw projectError || new Error("프로젝트를 찾을 수 없습니다.");

    const { data: scene, error: sceneError } = await supabase
      .from("video_scenes")
      .select("*")
      .eq("project_id", id)
      .in("quality_status", ["pending", "revision_required", "failed"])
      .order("scene_number")
      .limit(1)
      .maybeSingle();
    if (sceneError) throw sceneError;

    if (!scene) {
      const { count: blocked } = await supabase
        .from("video_scenes")
        .select("id", { count: "exact", head: true })
        .eq("project_id", id)
        .neq("quality_status", "approved");
      return NextResponse.json({
        success: true,
        done: true,
        readyForRunway: (blocked || 0) === 0,
        message: (blocked || 0) === 0
          ? "모든 장면 이미지가 품질검수를 통과했습니다."
          : "일부 장면이 품질 보류 상태입니다. 상품 사진과 설명을 보강해 새 프로젝트로 다시 검사해주세요.",
      });
    }

    sceneId = scene.id;
    const references = referenceUrls(project as Record<string, unknown>);
    if (!references.length) throw new Error("상품 참조 이미지가 없습니다.");
    const threshold = Math.max(80, Math.min(95, Number(project.quality_threshold) || 85));
    const maxRetries = Math.max(1, Math.min(2, Number(project.max_image_retries) || 2));
    const attempt = Math.max(0, Number(scene.image_retry_count) || 0) + 1;

    await supabase.from("video_projects").update({ status: "image_quality", updated_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("video_scenes").update({
      quality_status: "generating",
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", scene.id);

    const scenePrompt = [
      scene.prompt,
      "제공된 상품 참조 이미지의 동일한 제품을 사용한다.",
      "상품의 색상, 외형, 버튼, 포트, 구성품, 재질과 비율을 임의로 바꾸지 않는다.",
      "세로형 9:16 쇼핑 쇼츠의 한 장면이며 한 장면에는 하나의 행동만 보여준다.",
      "이미지 안에 상품명, 가격, 자막, 로고, 인증마크 또는 읽을 수 있는 글자를 새로 만들지 않는다.",
      "과장된 크기, 비현실적인 효과, 과도한 광택을 피하고 실제 촬영처럼 자연스럽게 만든다.",
    ].join(" ");
    const draft = await generateReferenceImageCandidates({
      title: `${project.title}-scene-${scene.scene_number}-attempt-${attempt}`,
      prompt: scenePrompt,
      referenceImageUrls: references,
      count: 3,
      quality: "low",
      size: "1024x1824",
    });

    await supabase.from("video_scenes").update({ quality_status: "reviewing" }).eq("id", scene.id);
    const draftReview = await reviewSceneImageCandidates({
      productName: project.product_name,
      productDescription: project.product_description,
      scenePrompt,
      referenceImageUrls: references,
      candidates: draft.candidates,
      threshold,
    });

    if (!draftReview.report.approved) {
      const hold = attempt >= maxRetries;
      await supabase.from("video_scenes").update({
        image_candidates: draftReview.candidates,
        selected_image_url: null,
        selected_image_model: draft.model,
        quality_status: hold ? "hold" : "revision_required",
        quality_score: draftReview.report.score,
        quality_report: draftReview.report,
        image_retry_count: attempt,
        error_message: draftReview.report.issues.join(" · ") || "상품 일치도 기준에 미달했습니다.",
        updated_at: new Date().toISOString(),
      }).eq("id", scene.id);
      return NextResponse.json({
        success: true,
        done: false,
        approved: false,
        hold,
        sceneNumber: scene.scene_number,
        report: draftReview.report,
        message: hold
          ? `장면 ${scene.scene_number}은 ${maxRetries}회 검수 후 보류했습니다. Runway 비용은 사용하지 않았습니다.`
          : `장면 ${scene.scene_number}이 ${draftReview.report.score}점으로 재생성 대상입니다.`,
      });
    }

    const finalImage = await finalizeReferenceImage({
      title: `${project.title}-scene-${scene.scene_number}`,
      prompt: scenePrompt,
      referenceImageUrls: references,
      draftImageUrl: draftReview.best.assetUrl,
    });
    const finalReview = await reviewSceneImageCandidates({
      productName: project.product_name,
      productDescription: project.product_description,
      scenePrompt,
      referenceImageUrls: references,
      candidates: [finalImage.image],
      threshold,
    });
    const approved = finalReview.report.approved;
    const hold = !approved && attempt >= maxRetries;

    await supabase.from("video_scenes").update({
      image_candidates: draftReview.candidates,
      selected_image_url: approved ? finalImage.image.assetUrl : null,
      selected_image_model: finalImage.model,
      quality_status: approved ? "approved" : hold ? "hold" : "revision_required",
      quality_score: finalReview.report.score,
      quality_report: { ...finalReview.report, draft: draftReview.report },
      image_retry_count: attempt,
      quality_approved_at: approved ? new Date().toISOString() : null,
      error_message: approved ? null : finalReview.report.issues.join(" · ") || "최종 이미지 검수 기준 미달",
      updated_at: new Date().toISOString(),
    }).eq("id", scene.id);

    const { count: remaining } = await supabase
      .from("video_scenes")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .neq("quality_status", "approved");
    if ((remaining || 0) === 0) {
      await supabase.from("video_projects").update({ status: "images_approved", updated_at: new Date().toISOString() }).eq("id", id);
    }

    return NextResponse.json({
      success: true,
      done: (remaining || 0) === 0,
      approved,
      hold,
      sceneNumber: scene.scene_number,
      imageUrl: approved ? finalImage.image.assetUrl : null,
      report: finalReview.report,
      message: approved
        ? `장면 ${scene.scene_number}이 ${finalReview.report.score}점으로 품질검수를 통과했습니다.`
        : hold
          ? `장면 ${scene.scene_number}은 품질 보류했습니다. Runway 비용은 사용하지 않았습니다.`
          : `장면 ${scene.scene_number} 최종 이미지가 기준에 미달해 다시 생성합니다.`,
    });
  } catch (error) {
    console.error("SCENE IMAGE QUALITY FAILED", error);
    if (sceneId) {
      await supabase.from("video_scenes").update({
        quality_status: "failed",
        error_message: error instanceof Error ? error.message : "이미지 품질검수 실패",
        updated_at: new Date().toISOString(),
      }).eq("id", sceneId);
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "장면 이미지 생성·검수에 실패했습니다." },
      { status: 500 },
    );
  }
}
