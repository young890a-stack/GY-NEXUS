import type { ContentFactoryPackage } from "@/lib/content-factory/types";
import type { ProductInsight, ShoppingShortsVariant } from "./types";

export function shoppingVariantToFactoryPackage(input: {
  productName: string;
  product: ProductInsight;
  variant: ShoppingShortsVariant;
}): ContentFactoryPackage {
  const { productName, product, variant } = input;
  return {
    packageTitle: `${productName} ${variant.variantKey} 제작 패키지`,
    positioning: {
      targetAudience: product.targetAudience,
      coreProblem: product.painPoints[0] || "일상에서 반복되는 불편",
      coreBenefit: product.sellingPoints[0] || product.keyFeatures[0] || "상품의 핵심 효용",
      recommendedAngle: variant.hookStyle,
    },
    blog: {
      seoTitle: variant.title,
      metaDescription: variant.description.slice(0, 160),
      outline: product.sellingPoints,
      body: variant.description,
      cta: variant.cta,
      hashtags: variant.hashtags,
      disclosure: "이 콘텐츠에는 제휴 링크가 포함될 수 있으며, 구매 시 수수료를 받을 수 있습니다.",
    },
    shorts: {
      title: variant.title,
      durationSeconds: variant.duration,
      hook: variant.hook,
      voiceover: variant.script,
      scenes: variant.scenes.map((scene) => ({
        start: scene.start,
        end: scene.end,
        visual: scene.visual,
        narration: scene.narration,
        subtitle: scene.subtitle,
      })),
      description: variant.description,
      pinnedComment: variant.cta,
      hashtags: variant.hashtags,
    },
    creative: {
      thumbnailCopy: [variant.thumbnail.headline, variant.thumbnail.subline, variant.thumbnail.badge],
      thumbnailPrompt: variant.thumbnail.visualDirection,
      squareThumbnailPrompt: variant.thumbnail.visualDirection,
      blogImagePrompts: variant.scenes.map((scene) => scene.visual).slice(0, 5),
      verticalVideoPrompt: variant.scenes.map((scene) => scene.visual).join("\n"),
    },
    seo: {
      primaryKeyword: productName,
      secondaryKeywords: product.keyFeatures.slice(0, 8),
      slug: productName.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""),
      faq: [],
    },
    subtitles: {
      srt: variant.srt,
      plainText: variant.plainSubtitles,
    },
    compliance: {
      claimsToAvoid: product.cautions,
      finalChecklist: [
        "상품과 장면이 일치하는지 확인",
        "가격과 배송 정보가 최신인지 확인",
        "제휴 고지를 게시문에 포함",
        "공개 게시 전 대표 최종 승인",
      ],
    },
  };
}

