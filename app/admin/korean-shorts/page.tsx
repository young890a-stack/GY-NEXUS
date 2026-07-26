import ShortsProductionHub from "@/components/shorts-hub/ShortsProductionHub";
import { shoppingVariantToFactoryPackage } from "@/lib/shopping-shorts/factory-adapter";
import type { ProductInsight, ShoppingShortsVariant } from "@/lib/shopping-shorts/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "한국형 쇼핑 쇼츠 제작 | Dream Y | GY-NEXUS",
  description: "상품 전략, AI 장면, 한국어 음성·자막, 최종 MP4와 비공개 게시까지 이어지는 쇼핑 쇼츠 제작실입니다.",
};

type Mode = "manual" | "guided" | "auto";

export default async function KoreanShortsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; url?: string; run?: string; variant?: string; autostart?: string }>;
}) {
  const query = await searchParams;
  const initialMode: Mode = query.mode === "auto" || query.mode === "manual" ? query.mode : "guided";
  const initialAffiliateUrl = typeof query.url === "string" ? query.url : "";
  let initialDraft: Parameters<typeof ShortsProductionHub>[0]["initialDraft"] = undefined;

  if (query.run && query.variant) {
    const supabase = createAdminClient();
    const [{ data: run }, { data: variant }] = await Promise.all([
      supabase.from("shopping_shorts_runs").select("*").eq("id", query.run).single(),
      supabase.from("shopping_shorts_variants").select("*").eq("id", query.variant).eq("run_id", query.run).single(),
    ]);
    if (run && variant && variant.quality_status === "approved") {
      const mappedVariant: ShoppingShortsVariant = {
        variantKey: variant.variant_key,
        hookIndex: variant.hook_index,
        hookStyle: variant.hook_style,
        duration: variant.duration_seconds,
        hook: variant.hook,
        title: variant.title,
        description: variant.description,
        hashtags: variant.hashtags || [],
        script: variant.script,
        cta: variant.cta,
        thumbnail: variant.thumbnail,
        scenes: variant.scenes || [],
        srt: variant.srt,
        plainSubtitles: variant.plain_subtitles,
        fingerprint: variant.fingerprint,
        regenerationCount: variant.regeneration_count,
        quality: variant.quality_report,
      };
      initialDraft = {
        runId: run.id,
        variantId: variant.id,
        productName: run.product_name,
        productDescription: run.product_description,
        productUrl: run.product_url || "",
        productImageUrl: run.product_image_url || "",
        priceText: run.price_text || "",
        duration: mappedVariant.duration,
        hookStyle: mappedVariant.hookStyle,
        factoryResult: shoppingVariantToFactoryPackage({
          productName: run.product_name,
          product: run.product_analysis as ProductInsight,
          variant: mappedVariant,
        }),
      };
    }
  }

  return (
    <ShortsProductionHub
      initialMode={initialDraft ? "auto" : initialMode}
      initialAffiliateUrl={initialDraft?.productUrl || initialAffiliateUrl}
      initialDraft={initialDraft}
      initialAutoStart={Boolean(initialDraft && query.autostart === "1")}
    />
  );
}
