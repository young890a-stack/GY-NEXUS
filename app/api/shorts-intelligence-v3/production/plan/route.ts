import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createExactSubtitleCues } from "@/lib/creative-studio-pro/commerce";
import {
  generateV34ProductionPlan,
  getV34PlanningModel,
  type V34VariantPlan,
} from "@/lib/shorts-intelligence-v3/production-v34";

export const runtime = "nodejs";
export const maxDuration = 180;

const allowedDurations = new Set([15, 20, 25, 30]);
const allowedVoices = new Set(["marin", "coral", "shimmer", "cedar", "onyx", "echo"]);

function clean(value: unknown, max = 1000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeHttps(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("상품 이미지는 HTTPS 주소만 사용할 수 있습니다.");
  return parsed.toString();
}

function variantStyle(plan: V34VariantPlan) {
  if (plan.variantKey === "A") return "problem-solution";
  if (plan.variantKey === "B") return "cinematic-product";
  return "how-to";
}

function buildCommercePackage(plan: V34VariantPlan, productName: string, duration: number, productCode: string) {
  const disclosure = "이 콘텐츠는 제휴 활동의 일환으로 수수료를 제공받을 수 있습니다.";
  const subtitleCues = createExactSubtitleCues(plan.voiceover, duration);
  const youtubeTitle = clean(plan.title, 95);
  return {
    productCode,
    title: plan.title,
    hookOptions: plan.hookOptions,
    voiceover: plan.voiceover,
    description: plan.description,
    hashtags: plan.hashtags,
    disclosure,
    cta: plan.cta,
    thumbnailOptions: plan.thumbnailOptions,
    verifiedClaims: plan.verifiedClaims,
    cautions: plan.cautions,
    subtitleCues,
    qualityAudit: {
      approved: plan.qualityAudit.approved,
      score: plan.qualityAudit.score,
      summary: plan.qualityAudit.summary,
      issues: plan.qualityAudit.issues,
      checks: {
        claimSafety: plan.qualityAudit.checks.claimSafety,
        affiliateDisclosure: true,
        directExperienceLanguage: true,
        durationFit: plan.qualityAudit.checks.durationFit,
      },
    },
    platformVersions: {
      youtube: {
        title: youtubeTitle,
        description: `${plan.description}\n\n${disclosure}\n${plan.cta}`,
        script: plan.voiceover,
        hashtags: plan.hashtags.slice(0, 10),
      },
      instagram: {
        caption: `${plan.description}\n\n${disclosure}\n${plan.cta}`,
        script: plan.voiceover,
        hashtags: plan.hashtags.slice(0, 12),
      },
      douyin: {
        title: productName,
        caption: "한국형 신규 촬영·AI 재창작 버전",
        scriptSimplifiedChinese: "仅参考内容结构，使用全新素材重新创作。",
        hashtags: ["#好物", "#产品展示", "#生活方式", "#短视频"],
      },
      xiaohongshu: {
        title: productName,
        body: "중국 원본을 복제하지 않고 상품의 확인된 특징으로 새롭게 제작한 한국형 콘텐츠입니다.",
        hashtags: ["#好物分享", "#产品体验", "#生活好物", "#短视频"],
        cards: plan.scenes.map((scene) => ({
          order: scene.sceneNumber,
          headline: scene.subtitle,
          body: scene.proofPoint,
          visualDirection: scene.visualDirection,
        })),
      },
    },
  };
}

export async function POST(request: Request) {
  const createdProjectIds: string[] = [];
  let createdBatchId = "";
  try {
    const body = await request.json() as Record<string, unknown>;
    const runId = clean(body.runId, 80);
    const candidateId = clean(body.candidateId, 80);
    const productName = clean(body.productName, 160);
    const productDescription = clean(body.productDescription, 2500);
    const affiliateUrl = clean(body.affiliateUrl, 2000);
    const productImageUrl = safeHttps(clean(body.productImageUrl, 2000));
    const duration = Math.round(Number(body.duration) || 20);
    const voicePreset = allowedVoices.has(String(body.voicePreset)) ? String(body.voicePreset) : "marin";
    const qualityThreshold = Math.max(88, Math.min(95, Math.round(Number(body.qualityThreshold) || 90)));

    if (!runId || !candidateId) return NextResponse.json({ success: false, message: "V3-3 수집 작업과 분석 후보를 선택해주세요." }, { status: 400 });
    if (productName.length < 2) return NextResponse.json({ success: false, message: "상품명을 2자 이상 입력해주세요." }, { status: 400 });
    if (productDescription.length < 10) return NextResponse.json({ success: false, message: "허위 표현 검수를 위해 확인된 상품 설명을 10자 이상 입력해주세요." }, { status: 400 });
    if (!allowedDurations.has(duration)) return NextResponse.json({ success: false, message: "영상 길이는 15·20·25·30초 중에서 선택해주세요." }, { status: 400 });

    const supabase = createAdminClient();
    const [candidateResult, jobResult, segmentResult] = await Promise.all([
      supabase.from("china_video_candidates")
        .select("id,run_id,title,platform,url,total_intelligence_score,scene_analysis_status,scene_analysis_score,scene_analysis_summary,scene_analysis")
        .eq("id", candidateId)
        .eq("run_id", runId)
        .single(),
      supabase.from("china_scene_analysis_jobs_v3")
        .select("id,status,analysis_result")
        .eq("candidate_id", candidateId)
        .single(),
      supabase.from("china_scene_segments_v3")
        .select("role,start_second,end_second,visual_description,camera_direction,reusable_pattern,recreate_direction,hook_score,proof_score,copyright_risk_score")
        .eq("candidate_id", candidateId)
        .order("scene_index"),
    ]);
    const candidate = candidateResult.data;
    const sceneJob = jobResult.data;
    if (candidateResult.error || !candidate) throw candidateResult.error || new Error("V3-3 후보를 찾지 못했습니다.");
    if (jobResult.error || !sceneJob || sceneJob.status !== "completed") {
      return NextResponse.json({ success: false, message: "V3-3 Gemini 장면 정밀분석이 완료된 후보만 제작할 수 있습니다." }, { status: 400 });
    }
    if (segmentResult.error) throw segmentResult.error;

    const plan = await generateV34ProductionPlan({
      productName,
      productDescription,
      durationSeconds: duration as 15 | 20 | 25 | 30,
      candidateTitle: candidate.title || "제목 없음",
      candidatePlatform: candidate.platform || "unknown",
      candidateSummary: candidate.scene_analysis_summary || "",
      candidateScore: Number(candidate.scene_analysis_score || candidate.total_intelligence_score) || 0,
      segments: segmentResult.data || [],
    });

    const { data: batch, error: batchError } = await supabase.from("shorts_production_batches_v34").insert({
      run_id: runId,
      candidate_id: candidateId,
      scene_job_id: sceneJob.id,
      product_name: productName,
      product_description: productDescription,
      product_image_url: productImageUrl,
      affiliate_url: affiliateUrl || null,
      duration_seconds: duration,
      voice_preset: voicePreset,
      quality_threshold: qualityThreshold,
      provider: "openai",
      model: getV34PlanningModel(),
      status: "planning",
      source_snapshot: {
        candidateTitle: candidate.title,
        platform: candidate.platform,
        url: candidate.url,
        sceneAnalysisScore: candidate.scene_analysis_score,
        sourceSummary: plan.sourceSummary,
      },
    }).select("*").single();
    if (batchError || !batch) throw batchError || new Error("V3-4 제작 묶음을 저장하지 못했습니다.");
    createdBatchId = batch.id;

    const results: Array<Record<string, unknown>> = [];
    for (const variantPlan of plan.variants) {
      const planScore = Math.round((variantPlan.estimatedHookScore * .4) + (variantPlan.qualityAudit.score * .6));
      const { data: variant, error: variantError } = await supabase.from("shorts_production_variants_v34").insert({
        batch_id: batch.id,
        variant_key: variantPlan.variantKey,
        variant_type: variantPlan.variantType,
        title: variantPlan.title,
        hook: variantPlan.hookOptions[0],
        strategy_summary: variantPlan.strategySummary,
        target_audience: variantPlan.targetAudience,
        plan: variantPlan,
        plan_score: planScore,
        quality_threshold: qualityThreshold,
        status: variantPlan.qualityAudit.approved ? "planned" : "plan_review",
      }).select("*").single();
      if (variantError || !variant) throw variantError || new Error(`${variantPlan.variantKey}안 저장 실패`);

      const style = variantStyle(variantPlan);
      const voiceMode = ["cedar", "onyx", "echo"].includes(voicePreset) ? "male" : "female";
      const commercePackage = buildCommercePackage(variantPlan, productName, duration, `GY-V34-${batch.id.slice(0, 8)}-${variantPlan.variantKey}`);
      const productionSettings = {
        title: variantPlan.title,
        productUrl: affiliateUrl,
        affiliateUrl,
        productName,
        productDescription,
        masterPrompt: `${variantPlan.strategySummary} 중국 원본을 복제하지 않고 새로운 한국형 세로 쇼츠로 재창작한다.`,
        sourceMode: "single-photo-commerce",
        sourceImageUrl: productImageUrl,
        referenceImageUrls: [productImageUrl],
        duration,
        ratio: "720:1280",
        style,
        subtitleMode: "korean",
        voiceMode,
        voicePreset,
        musicMood: "modern-corporate",
        subtitleStyle: "bold-pop",
        thumbnailStyle: variantPlan.thumbnailOptions[0]?.layout || "problem-solution",
        sfxMode: "recommended",
        platformTargets: ["youtube", "instagram"],
        qualityThreshold,
        maxImageRetries: 2,
        mediaReferences: [],
        playbackSpeed: 1,
        subtitleCleanupMode: "recreate-clean",
        sourceAudioMode: "mute-korean-tts",
        mixStrategy: "recreate",
        trendIntelligence: {
          chineseKeywords: [],
          discoveryLinks: [{ platform: candidate.platform, keyword: candidate.title, url: candidate.url }],
          hookPatterns: (segmentResult.data || []).map((segment: Record<string, any>) => segment.reusable_pattern).filter(Boolean).slice(0, 8),
          sellingAngles: [variantPlan.strategySummary, ...variantPlan.verifiedClaims].filter(Boolean).slice(0, 8),
          originalShotPlan: variantPlan.scenes.map((scene) => ({
            order: scene.sceneNumber,
            durationSeconds: 5,
            role: scene.role,
            camera: scene.cameraDirection,
            direction: scene.visualDirection,
            assetType: "generated-scene",
          })),
          referenceRule: "도우인·샤오홍슈 원본은 최종 영상에 사용하지 않는다. V3-3에서 확인한 구조만 참고하고 상품 사진으로 새 장면을 생성한다.",
        },
        sourceMixPlan: {
          title: `${variantPlan.title} 생성 장면 타임라인`,
          totalDurationSeconds: duration,
          selectedReferenceIds: [],
          cuts: variantPlan.scenes.map((scene) => ({
            order: scene.sceneNumber,
            startSecond: (scene.sceneNumber - 1) * 5,
            durationSeconds: 5,
            sourceStartSecond: 0,
            sourceEndSecond: 5,
            referenceId: "",
            frameIndex: scene.sceneNumber - 1,
            role: scene.role,
            decision: "generated",
            direction: scene.visualDirection,
            subtitleIntent: scene.subtitle,
          })),
          safetySummary: "실제 상품 사진에서 생성한 신규 장면만 합성하며 권리 미확인 중국 원본은 사용하지 않습니다.",
          generatedAt: new Date().toISOString(),
          model: getV34PlanningModel(),
        },
        commercePackage,
        productionV34: {
          batchId: batch.id,
          variantId: variant.id,
          variantKey: variantPlan.variantKey,
          candidateId,
          sceneJobId: sceneJob.id,
          originalSourceUse: false,
        },
      };

      const { data: project, error: projectError } = await supabase.from("video_projects").insert({
        title: variantPlan.title,
        product_name: productName,
        product_description: productDescription,
        master_prompt: productionSettings.masterPrompt,
        source_image_url: productImageUrl,
        reference_image_urls: [productImageUrl],
        duration_seconds: duration,
        ratio: "720:1280",
        style,
        subtitle_mode: "korean",
        voice_mode: voiceMode,
        music_mood: "modern-corporate",
        status: "planned",
        scene_count: variantPlan.scenes.length,
        quality_threshold: qualityThreshold,
        max_image_retries: 2,
        render_approved: false,
        settings: productionSettings,
      }).select("*").single();
      if (projectError || !project) throw projectError || new Error(`${variantPlan.variantKey}안 영상 프로젝트 생성 실패`);
      createdProjectIds.push(project.id);

      const sceneRows = variantPlan.scenes.map((scene) => ({
        project_id: project.id,
        scene_number: scene.sceneNumber,
        start_second: (scene.sceneNumber - 1) * 5,
        end_second: scene.sceneNumber * 5,
        duration_seconds: 5,
        role: scene.role,
        prompt: [
          scene.visualDirection,
          scene.cameraDirection,
          scene.proofPoint,
          scene.recreateReason,
          "실제 상품 참조 이미지와 동일한 제품만 사용하고 읽을 수 있는 글자나 가격을 이미지에 만들지 않는다.",
        ].join(" "),
        narration: scene.narration,
        subtitle_text: scene.subtitle,
        status: "pending",
        quality_status: "pending",
        image_retry_count: 0,
      }));
      const { error: scenesError } = await supabase.from("video_scenes").insert(sceneRows);
      if (scenesError) throw scenesError;
      const { error: variantUpdateError } = await supabase.from("shorts_production_variants_v34").update({
        video_project_id: project.id,
        status: variantPlan.qualityAudit.approved ? "project_ready" : "plan_review",
        updated_at: new Date().toISOString(),
      }).eq("id", variant.id);
      if (variantUpdateError) throw variantUpdateError;
      results.push({ ...variant, video_project_id: project.id, project });
    }

    await supabase.from("shorts_production_batches_v34").update({ status: "project_ready", updated_at: new Date().toISOString() }).eq("id", batch.id);
    return NextResponse.json({
      success: true,
      batch: { ...batch, status: "project_ready" },
      variants: results,
      message: "A·B·C 쇼츠 기획과 3개 실제 제작 프로젝트를 만들었습니다. Runway 비용은 아직 사용하지 않았습니다.",
    }, { status: 201 });
  } catch (error) {
    const supabase = createAdminClient();
    if (createdProjectIds.length) {
      await supabase.from("video_scenes").delete().in("project_id", createdProjectIds);
      await supabase.from("video_projects").delete().in("id", createdProjectIds);
    }
    if (createdBatchId) await supabase.from("shorts_production_batches_v34").delete().eq("id", createdBatchId);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "V3-4 A·B·C 제작 기획에 실패했습니다." }, { status: 500 });
  }
}
