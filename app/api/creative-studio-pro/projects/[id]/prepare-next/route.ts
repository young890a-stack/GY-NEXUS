import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  finalizeReferenceImage,
  generateReferenceImageCandidates,
} from "@/lib/creative-studio/image";
import {
  analyzeProductVisualProfile,
  formatProductVisualLock,
  reviewSceneImageCandidates,
} from "@/lib/creative-studio-pro/quality";
import type { ProductVisualProfile } from "@/lib/creative-studio-pro/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function referenceUrls(project: Record<string, unknown>) {
  const stored = Array.isArray(project.reference_image_urls)
    ? project.reference_image_urls.map(String)
    : [];
  const fallback = typeof project.source_image_url === "string" ? [project.source_image_url] : [];
  return Array.from(new Set([...stored, ...fallback].map((value) => value.trim()).filter(Boolean))).slice(0, 4);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isProductVisualProfile(value: unknown): value is ProductVisualProfile {
  const item = objectValue(value);
  return typeof item.identitySummary === "string" &&
    typeof item.silhouette === "string" &&
    Array.isArray(item.forbiddenChanges) &&
    Number.isFinite(Number(item.referenceCoverageScore));
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
    const settings = objectValue(project.settings);
    const singlePhoto = settings.sourceMode === "single-photo-commerce";
    const minimumReferences = singlePhoto ? 1 : 2;
    if (references.length < minimumReferences) throw new Error(singlePhoto
      ? "사진 한 장 쇼츠를 만들려면 실제 상품 이미지 1장을 올려주세요."
      : "유료 품질 기준을 위해 앞·뒤 또는 서로 다른 각도의 실제 상품 사진을 최소 2장 올려주세요.");
    const threshold = Math.max(80, Math.min(95, Number(project.quality_threshold) || 85));
    const maxRetries = Math.max(1, Math.min(2, Number(project.max_image_retries) || 2));
    const attempt = Math.max(0, Number(scene.image_retry_count) || 0) + 1;

    let visualProfile = settings.visualProfile;
    if (!isProductVisualProfile(visualProfile)) {
      const analysis = await analyzeProductVisualProfile({
        productName: project.product_name,
        productDescription: project.product_description,
        referenceImageUrls: references,
      });
      visualProfile = analysis.profile;
      await supabase.from("video_projects").update({
        settings: { ...settings, visualProfile: analysis.profile, visualProfileModel: analysis.model },
        updated_at: new Date().toISOString(),
      }).eq("id", id);
    }
    if (!isProductVisualProfile(visualProfile)) throw new Error("상품 시각 정체성을 확정하지 못했습니다.");
    if (!singlePhoto && visualProfile.referenceCoverageScore < 72) {
      const gaps = visualProfile.referenceGaps.join(" · ") || "상품의 앞·뒤·측면 세부 구조가 부족합니다.";
      throw new Error(`상품 사진 사실자료가 부족합니다(${visualProfile.referenceCoverageScore}점). ${gaps}`);
    }

    const { data: previousScene, error: previousSceneError } = await supabase
      .from("video_scenes")
      .select("selected_image_url")
      .eq("project_id", id)
      .eq("quality_status", "approved")
      .lt("scene_number", scene.scene_number)
      .order("scene_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previousSceneError) throw previousSceneError;
    const continuityImageUrls = typeof previousScene?.selected_image_url === "string"
      ? [previousScene.selected_image_url]
      : [];

    await supabase.from("video_projects").update({ status: "image_quality", updated_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("video_scenes").update({
      quality_status: "generating",
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", scene.id);

    const scenePrompt = [
      scene.prompt,
      formatProductVisualLock(visualProfile),
      "제공된 상품 참조 이미지의 동일한 제품을 사용한다.",
      singlePhoto
        ? "사진 한 장 쇼츠 모드다. 원본에서 보이지 않는 뒤·옆면, 버튼, 포트나 구성품을 새로 만들지 않는다. 동일한 전면 제품을 유지하고 배경·조명·그래픽 연출만 바꾼다."
        : "서로 다른 실제 사진에서 확인된 구조만 장면에 사용한다.",
      "상품의 색상, 외형, 버튼, 포트, 구성품, 재질과 비율을 임의로 바꾸지 않는다.",
      "세로형 9:16 쇼핑 쇼츠의 한 장면이며 한 장면에는 하나의 행동만 보여준다.",
      "이미지 안에 상품명, 가격, 자막, 로고, 인증마크 또는 읽을 수 있는 글자를 새로 만들지 않는다.",
      "과장된 크기, 비현실적인 효과, 과도한 광택을 피하고 실제 촬영처럼 자연스럽게 만든다.",
      continuityImageUrls.length
        ? "직전 승인 장면과 동일한 상품, 인물, 조명과 색감을 유지해 자연스럽게 이어지게 한다."
        : "첫 장면에서 확정한 상품과 광고의 시각 기준을 이후 장면에서도 유지할 수 있게 명확하게 표현한다.",
      "Runway에서 제품이 녹거나 변형되지 않도록 한 번에 하나의 단순한 동작과 안정된 제품 경계를 만든다.",
      "세로 화면 위아래 12%에는 중요한 상품 요소를 두지 않는다.",
    ].join(" ");
    const draft = await generateReferenceImageCandidates({
      title: `${project.title}-scene-${scene.scene_number}-attempt-${attempt}`,
      prompt: scenePrompt,
      referenceImageUrls: references,
      continuityImageUrls,
      count: 3,
      quality: "medium",
      size: "1024x1824",
    });

    await supabase.from("video_scenes").update({ quality_status: "reviewing" }).eq("id", scene.id);
    const draftReview = await reviewSceneImageCandidates({
      productName: project.product_name,
      productDescription: project.product_description,
      scenePrompt,
      visualProfile,
      referenceImageUrls: references,
      continuityImageUrls,
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
      continuityImageUrls,
      draftImageUrl: draftReview.best.assetUrl,
    });
    const finalReview = await reviewSceneImageCandidates({
      productName: project.product_name,
      productDescription: project.product_description,
      scenePrompt,
      visualProfile,
      referenceImageUrls: references,
      continuityImageUrls,
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
