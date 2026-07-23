import type { MetadataRoute } from "next";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://gy-nexus-zfpq.vercel.app").replace(/\/$/, "");
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/products`, changeFrequency: "daily", priority: .9 },
    { url: `${baseUrl}/pricing`, changeFrequency: "monthly", priority: .7 },
  ];
  if (!hasSupabaseEnv()) return staticPages;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("products").select("slug,updated_at").eq("is_public", true).eq("status", "published").limit(1000);
    return [...staticPages, ...(data ?? []).map((item) => ({ url: `${baseUrl}/products/${item.slug}`, lastModified: item.updated_at ? new Date(item.updated_at) : undefined, changeFrequency: "weekly" as const, priority: .8 }))];
  } catch { return staticPages; }
}
