import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCommercePackage } from "@/lib/creative-studio-pro/commerce";
import {
  generateTrendIntelligence,
  gyProductCode,
  normalizeMediaReferences,
} from "@/lib/creative-studio-pro/integration";

export const runtime = "nodejs";
export const maxDuration = 180;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const startedAt = Date.now();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as { force?: boolean };
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const { data: scenes, error: sceneError } = await supabase
      .from("video_scenes")
      .select("narration")
      .eq("project_id", id)
      .order("scene_number");
    if (sceneError) throw sceneError;

    const settings = record(project.settings);
    const mediaReferences = normalizeMediaReferences(settings.mediaReferences);
    const referenceNotes = mediaReferences
      .map((item) => [
        item.title,
        item.notes,
        `${item.assetKind} · ${item.rightsStatus} · AI 믹스 ${item.includeInMixAnalysis ? "선택" : "제외"}`,
        item.analysisFrameUrls.length ? `분석 프레임 ${item.analysisFrameUrls.length}장` : "",
        item.selectedKeywords.length ? `선택 키워드 ${item.selectedKeywords.join(", ")}` : "",
        item.analysis?.sourceSummary || "",
        ...(item.analysis?.hookPatterns || []),
        ...(item.analysis?.salesPoints || []),
      ].filter(Boolean).join(": "))
      .filter(Boolean);
    const productCode = typeof settings.gyProductCode === "string"
      ? settings.gyProductCode
      : gyProductCode(project.id);
    const fingerprint = createHash("sha256").update(JSON.stringify({
      productName: project.product_name,
      productDescription: project.product_description || "",
      durationSeconds: Number(project.duration_seconds) || 20,
      style: project.style || "cinematic-product",
      affiliateUrl: settings.affiliateUrl || "",
      platformTargets: settings.platformTargets || [],
      referenceNotes,
    })).digest("hex");
    if (
      !body.force
      && settings.productizationFingerprint === fingerprint
      && settings.trendIntelligence
      && settings.commercePackage
    ) {
      return NextResponse.json({
        success: true,
        cached: true,
        productCode,
        trendIntelligence: settings.trendIntelligence,
        package: settings.commercePackage,
        elapsedMs: Date.now() - startedAt,
        message: "입력 내용이 같아 검수 완료 결과를 즉시 불러왔습니다.",
      });
    }
    const durationSeconds = Number(project.duration_seconds) || 20;
    const platformTargets = Array.isArray(settings.platformTargets) ? settings.platformTargets.map(String) : ["youtube"];
    const koreanOnly = platformTargets.every((target) => target === "youtube" || target === "instagram");
    const koreanDirectTrend = {
      model: "korean-direct",
      result: {
        chineseKeywords: [],
        discoveryLinks: [],
        hookPatterns: [],
        sellingAngles: [],
        originalShotPlan: [],
        referenceRule: "한국형 쇼츠는 중국 소스 분석을 실행하지 않습니다.",
        generatedAt: new Date().toISOString(),
        model: "korean-direct",
      },
    };
    const [trend, commerce] = await Promise.all([
      koreanOnly ? Promise.resolve(koreanDirectTrend) : generateTrendIntelligence({
        productName: project.product_name,
        productDescription: project.product_description || "",
        durationSeconds,
        referenceNotes,
      }),
      generateCommercePackage({
        productName: project.product_name,
        productDescription: project.product_description || "",
        durationSeconds,
        style: project.style || "cinematic-product",
        productUrl: typeof settings.productUrl === "string" ? settings.productUrl : undefined,
        affiliateUrl: typeof settings.affiliateUrl === "string" ? settings.affiliateUrl : undefined,
        platformTargets,
        sceneNarrations: (scenes || []).map((scene) => String(scene.narration || "")).filter(Boolean),
        productCode,
      }),
    ]);
    const now = new Date().toISOString();
    const nextSettings = {
      ...settings,
      mediaReferences,
      gyProductCode: productCode,
      trendIntelligence: trend.result,
      trendIntelligenceUpdatedAt: now,
      commercePackage: commerce.result,
      commercePackageModel: commerce.model,
      commercePackageUpdatedAt: now,
      productizationFingerprint: fingerprint,
      selectedHookIndex: null,
      selectedHook: null,
      contentApprovedAt: null,
      contentApprovalChecklist: null,
      voiceAudioUrl: null,
      voiceName: null,
    };
    const { error: updateError } = await supabase.from("video_projects").update({
      settings: nextSettings,
      render_approved: false,
      render_approved_at: null,
      updated_at: now,
    }).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({
      success: true,
      productCode,
      trendIntelligence: trend.result,
      package: commerce.result,
      elapsedMs: Date.now() - startedAt,
      message: koreanOnly
        ? "한국형 쇼츠 전용으로 중국 분석을 생략하고 한국 플랫폼 패키지와 품질검수를 완료했습니다."
        : "중국 탐색 키워드·장면 분석·4개 플랫폼 게시 패키지를 병렬 생성했습니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "쇼핑 쇼츠 통합 상품화 준비에 실패했습니다.",
    }, { status: 500 });
  }
}
