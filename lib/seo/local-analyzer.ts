import type { SeoInput, SeoScores } from "@/lib/seo/types";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const count = (text: string, needle: string) => {
  if (!needle.trim()) return 0;
  return text.toLowerCase().split(needle.toLowerCase()).length - 1;
};

export function analyzeSeoLocally(input: SeoInput): SeoScores {
  const titleLength = input.title.trim().length;
  const contentLength = input.content.replace(/\s+/g, " ").trim().length;
  const keyword = input.primaryKeyword.trim();
  const keywordCount = count(`${input.title} ${input.content}`, keyword);
  const keywordDensity = contentLength ? (keywordCount * keyword.length / contentLength) * 100 : 0;
  const paragraphs = input.content.split(/\n\s*\n/).filter(Boolean).length;
  const headingCount = (input.content.match(/^#{1,3}\s+/gm) || []).length;
  const sentenceCount = Math.max(1, (input.content.match(/[.!?。！？]/g) || []).length);
  const averageSentence = contentLength / sentenceCount;

  const titleScore = clamp(100 - Math.abs(42 - titleLength) * 2.3 + (input.title.toLowerCase().includes(keyword.toLowerCase()) ? 15 : -10));
  const contentScore = clamp(contentLength >= 1800 ? 95 : contentLength / 18);
  const keywordScore = clamp(keywordDensity >= 0.6 && keywordDensity <= 2.5 ? 95 : 70 - Math.abs(1.5 - keywordDensity) * 22);
  const readability = clamp(100 - Math.max(0, averageSentence - 45) * 1.2 + Math.min(15, paragraphs * 2));
  const ctr = clamp(58 + (/[0-9]/.test(input.title) ? 10 : 0) + (/최신|가이드|방법|추천|비교|완벽/.test(input.title) ? 15 : 0) + (titleLength <= 55 ? 10 : -8));
  const structure = clamp(45 + Math.min(30, headingCount * 8) + Math.min(20, paragraphs * 2));
  const overall = clamp(titleScore * .2 + contentScore * .2 + keywordScore * .17 + readability * .13 + ctr * .15 + structure * .15);
  return { overall, title: titleScore, content: contentScore, keyword: keywordScore, readability, ctr, structure };
}
