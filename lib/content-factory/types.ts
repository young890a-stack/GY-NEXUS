export type FactoryInput = {
  productId?: string;
  title: string;
  description?: string;
  affiliateUrl?: string;
  imageUrl?: string;
  targetAudience?: string;
  shortsDuration?: 15 | 20 | 25 | 30;
  tone?: string;
};

export type ContentFactoryPackage = {
  packageTitle: string;
  positioning: {
    targetAudience: string;
    coreProblem: string;
    coreBenefit: string;
    recommendedAngle: string;
  };
  blog: {
    seoTitle: string;
    metaDescription: string;
    body: string;
    hashtags: string[];
    disclosure: string;
  };
  shorts: {
    title: string;
    durationSeconds: number;
    hook: string;
    voiceover: string;
    scenes: Array<{
      start: number;
      end: number;
      visual: string;
      narration: string;
      subtitle: string;
    }>;
    description: string;
    hashtags: string[];
  };
  creative: {
    thumbnailCopy: string[];
    thumbnailPrompt: string;
    blogImagePrompts: string[];
    verticalVideoPrompt: string;
  };
  subtitles: {
    srt: string;
    plainText: string;
  };
  compliance: {
    claimsToAvoid: string[];
    finalChecklist: string[];
  };
};
