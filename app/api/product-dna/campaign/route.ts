import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateProductDNA } from "@/lib/product-dna/generate";
import { generateCreativeImage } from "@/lib/creative-studio/image";
import { planScenes } from "@/lib/creative-studio-pro/planner";
import type { DNACampaignInput } from "@/lib/product-dna/types";
import type { ProProjectInput } from "@/lib/creative-studio-pro/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const input = await request.json() as DNACampaignInput;
    const productName = input.productName?.trim() || input.title?.trim();
    if (!input.sourceUrl?.trim() || !productName) return NextResponse.json({ success: false, message: "제휴링크와 상품명을 확인해주세요." }, { status: 400 });
    if (![20, 25, 30].includes(input.duration)) return NextResponse.json({ success: false, message: "영상 길이는 20·25·30초 중 선택해주세요." }, { status: 400 });

    const dna = await generateProductDNA(input);
    const generatedImage = await generateCreativeImage({
      title: `${productName}-product-dna`,
      kind: "shorts_cover",
      prompt: `${dna.imagePrompt}\n신규 상업 광고 비주얼. 원본 판매 페이지의 사진 구도, 배경, 텍스트, 로고, 캐릭터를 복제하지 않는다. 제품의 일반적 용도와 형태만 사실적으로 표현한다. ${dna.visualIdentity.mood}, ${dna.visualIdentity.setting}, ${dna.visualIdentity.camera}, ${dna.visualIdentity.lighting}, ${dna.visualIdentity.palette}.`,
      size: "1024x1536",
      transparent: false,
    });

    const supabase = createAdminClient();
    const { data: imported, error: importError } = await supabase.from("affiliate_imports").insert({
      source_url: input.sourceUrl,
      resolved_url: input.resolvedUrl || input.sourceUrl,
      platform: input.platform,
      product_title: productName,
      product_description: input.productDescription?.trim() || input.description || "",
      price_text: input.priceText || "",
      source_image_url: input.manualImageUrl?.trim() || input.imageUrl || null,
      extraction_status: input.extractionStatus || "manual",
      extraction_method: input.extractionMethod || "manual",
      blocked_reason: input.blockedReason || null,
      confidence: input.confidence || { title: 0, description: 0, image: 0, price: 0 },
      rights_mode: "transformative-reference-only",
      raw_metadata: input,
    }).select("*").single();
    if (importError || !imported) throw importError || new Error("제휴 상품 저장 실패");

    const proStyle: ProProjectInput["style"] = input.style === "ugc" ? "ugc-review" : input.style === "emotional" ? "emotional-brand" : input.style === "million-view" ? "problem-solution" : "cinematic-product";
    const projectInput: ProProjectInput = {
      title: `${productName} · Product DNA ${input.duration}초`,
      productName,
      productDescription: input.productDescription?.trim() || input.description || dna.oneLineValue,
      masterPrompt: `${dna.masterVideoPrompt} 신규 장면과 신규 카메라 구도로 제작하며 원본 판매 페이지의 사진, 영상, 문구, 로고를 복제하지 않는다.`,
      sourceImageUrl: generatedImage.assetUrl,
      duration: input.duration,
      ratio: "720:1280",
      style: proStyle,
      subtitleMode: "korean",
      voiceMode: "female",
      musicMood: "modern-corporate",
    };
    const scenes = planScenes(projectInput);
    const { data: videoProject, error: projectError } = await supabase.from("video_projects").insert({
      title: projectInput.title,
      product_name: productName,
      product_description: projectInput.productDescription,
      master_prompt: projectInput.masterPrompt,
      source_image_url: generatedImage.assetUrl,
      duration_seconds: input.duration,
      ratio: projectInput.ratio,
      style: projectInput.style,
      subtitle_mode: projectInput.subtitleMode,
      voice_mode: projectInput.voiceMode,
      music_mood: projectInput.musicMood,
      status: "planned",
      scene_count: scenes.length,
      settings: { ...projectInput, productDna: dna, affiliateImportId: imported.id },
    }).select("*").single();
    if (projectError || !videoProject) throw projectError || new Error("영상 프로젝트 저장 실패");
    const { error: scenesError } = await supabase.from("video_scenes").insert(scenes.map((scene) => ({
      project_id: videoProject.id,
      scene_number: scene.sceneNumber,
      start_second: scene.startSecond,
      end_second: scene.endSecond,
      duration_seconds: scene.duration,
      role: scene.role,
      prompt: scene.prompt,
      narration: scene.narration,
      subtitle_text: scene.subtitle,
      status: "pending",
    })));
    if (scenesError) throw scenesError;

    const { data: campaign, error: campaignError } = await supabase.from("product_dna_campaigns").insert({
      affiliate_import_id: imported.id,
      video_project_id: videoProject.id,
      product_name: productName,
      campaign_style: input.style,
      target_audience: input.targetAudience || "20~40대",
      duration_seconds: input.duration,
      dna,
      generated_image_url: generatedImage.assetUrl,
      blog_title: dna.blogTitle,
      blog_html: dna.blogHtml,
      shorts_title: dna.shortsTitle,
      shorts_description: dna.shortsDescription,
      hashtags: dna.hashtags,
      status: "ready",
    }).select("*").single();
    if (campaignError || !campaign) throw campaignError || new Error("캠페인 저장 실패");

    return NextResponse.json({ success: true, campaign, dna, imageUrl: generatedImage.assetUrl, videoProject });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Product DNA 캠페인 생성에 실패했습니다." }, { status: 500 });
  }
}
