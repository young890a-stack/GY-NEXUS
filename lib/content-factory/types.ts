export type FactoryInput = {
  productId?: string;
  title: string;
  description?: string;
  affiliateUrl?: string;
  imageUrl?: string;
  targetAudience?: string;
  shortsDuration?: 15 | 20 | 25 | 30;
  tone?: string;
  blogGoal?: "adsense" | "adpost" | "sales" | "review";
  blogLength?: "standard" | "long";
};

export type ContentFactoryPackage = {
  packageTitle: string;
  positioning: { targetAudience: string; coreProblem: string; coreBenefit: string; recommendedAngle: string };
  blog: { seoTitle: string; metaDescription: string; outline: string[]; body: string; cta: string; hashtags: string[]; disclosure: string };
  shorts: { title: string; durationSeconds: number; hook: string; voiceover: string; scenes: Array<{start:number;end:number;visual:string;narration:string;subtitle:string}>; description: string; pinnedComment: string; hashtags: string[] };
  creative: { thumbnailCopy: string[]; thumbnailPrompt: string; squareThumbnailPrompt: string; blogImagePrompts: string[]; verticalVideoPrompt: string };
  seo: { primaryKeyword: string; secondaryKeywords: string[]; slug: string; faq: Array<{question:string;answer:string}> };
  subtitles: { srt: string; plainText: string };
  compliance: { claimsToAvoid: string[]; finalChecklist: string[] };
};
