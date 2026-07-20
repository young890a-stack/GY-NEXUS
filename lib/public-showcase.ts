import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type PublicShowcaseVideo = {
  id: string;
  title: string;
  productName: string;
  productDescription: string;
  videoUrl: string;
  posterUrl: string;
  durationSeconds: number;
  affiliateUrl: string;
  publishedAt: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function getPublicShowcaseVideos(limit = 12): Promise<PublicShowcaseVideo[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("video_projects")
      .select("id,title,product_name,product_description,source_image_url,duration_seconds,final_video_url,settings,created_at,updated_at")
      .not("final_video_url", "is", null)
      .order("updated_at", { ascending: false })
      .limit(60);

    if (error) throw error;

    return (data || [])
      .map((project) => {
        const settings = record(project.settings);
        const commerce = record(settings.commercePackage);
        const published = settings.publicShowcase === true;
        const videoUrl = text(project.final_video_url);

        if (!published || !videoUrl) return null;

        return {
          id: String(project.id),
          title: text(settings.showcaseTitle) || text(commerce.title) || text(project.title) || text(project.product_name),
          productName: text(project.product_name) || "GY 추천 상품",
          productDescription: text(settings.showcaseDescription) || text(project.product_description) || "실제 사용 장면 중심으로 제작한 쇼핑 쇼츠입니다.",
          videoUrl,
          posterUrl: text(settings.showcasePosterUrl) || text(project.source_image_url),
          durationSeconds: Math.max(1, Number(project.duration_seconds) || 20),
          affiliateUrl: text(settings.affiliateUrl) || text(settings.productUrl),
          publishedAt: text(settings.showcasePublishedAt) || text(project.updated_at) || text(project.created_at),
        } satisfies PublicShowcaseVideo;
      })
      .filter((item): item is PublicShowcaseVideo => Boolean(item))
      .slice(0, Math.max(1, Math.min(30, limit)));
  } catch {
    return [];
  }
}
