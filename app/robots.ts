import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://gy-nexus-zfpq.vercel.app").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: ["/", "/products", "/products/"], disallow: ["/admin", "/member", "/api", "/billing", "/go"] }],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
