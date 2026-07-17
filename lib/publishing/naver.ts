export type NaverPackage = { title: string; content: string; tags: string[]; imageUrls: string[]; shareUrl: string; text: string };
export function createNaverPublishPackage(input: { title: string; content: string; tags?: string[]; imageUrls?: string[]; sourceUrl?: string }): NaverPackage {
  const tags = (input.tags || []).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean).slice(0, 30);
  const imageUrls = (input.imageUrls || []).filter(Boolean);
  const tagLine = tags.length ? `\n\n${tags.map((tag) => `#${tag}`).join(" ")}` : "";
  const imageLine = imageUrls.length ? `\n\n[이미지]\n${imageUrls.join("\n")}` : "";
  const text = `${input.title}\n\n${input.content}${imageLine}${tagLine}`;
  const target = input.sourceUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://blog.naver.com";
  return { title: input.title, content: input.content, tags, imageUrls, text, shareUrl: `https://share.naver.com/web/shareView?url=${encodeURIComponent(target)}&title=${encodeURIComponent(input.title)}` };
}
