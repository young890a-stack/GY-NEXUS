export type SeoInput = {
  title: string;
  content: string;
  primaryKeyword: string;
  targetAudience?: string;
  contentUrl?: string;
};

export type SeoScores = {
  overall: number;
  title: number;
  content: number;
  keyword: number;
  readability: number;
  ctr: number;
  structure: number;
};

export type ThumbnailVariant = {
  label: "A" | "B" | "C";
  headline: string;
  subline: string;
  visualDirection: string;
  predictedCtr: number;
};

export type SeoReport = {
  scores: SeoScores;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  headings: string[];
  faq: { question: string; answer: string }[];
  internalLinkIdeas: string[];
  altTexts: string[];
  improvements: string[];
  strengths: string[];
  shorts: {
    title: string;
    hook: string;
    script: string;
    cta: string;
    description: string;
    hashtags: string[];
  };
  thumbnails: ThumbnailVariant[];
};
