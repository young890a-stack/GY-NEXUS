export type ProDuration = 20 | 25 | 30;
export type ProRatio = "720:1280" | "1280:720";
export type ProStyle = "cinematic-product" | "emotional-brand" | "how-to" | "ugc-review" | "problem-solution";
export type SubtitleMode = "korean" | "none";
export type VoiceMode = "female" | "male" | "music-only" | "silent";

export type ProProjectInput = {
  title: string;
  productUrl?: string;
  productName: string;
  productDescription: string;
  masterPrompt: string;
  sourceImageUrl?: string;
  referenceImageUrls?: string[];
  duration: ProDuration;
  ratio: ProRatio;
  style: ProStyle;
  subtitleMode: SubtitleMode;
  voiceMode: VoiceMode;
  musicMood: string;
  qualityThreshold?: number;
  maxImageRetries?: number;
};

export type SceneQualityStatus =
  | "pending"
  | "generating"
  | "reviewing"
  | "approved"
  | "revision_required"
  | "hold"
  | "failed";

export type SceneImageCandidate = {
  index: number;
  assetUrl: string;
  storagePath?: string;
  score?: number;
  issues?: string[];
};

export type SceneQualityReport = {
  provider: "openai";
  model: string;
  threshold: number;
  score: number;
  approved: boolean;
  summary: string;
  issues: string[];
  metrics: {
    productMatch: number;
    visualIntegrity: number;
    commercialNaturalness: number;
    composition: number;
    claimSafety: number;
  };
};

export type PlannedScene = {
  sceneNumber: number;
  startSecond: number;
  endSecond: number;
  duration: 5;
  role: string;
  prompt: string;
  narration: string;
  subtitle: string;
};
