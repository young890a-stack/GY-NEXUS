export type ProDuration = 20 | 25 | 30;
export type ProRatio = "720:1280" | "1280:720";
export type ProStyle = "cinematic-product" | "emotional-brand" | "how-to" | "ugc-review" | "problem-solution";
export type SubtitleMode = "korean" | "none";
export type VoiceMode = "female" | "male" | "music-only" | "silent";

export type ProProjectInput = {
  title: string;
  productName: string;
  productDescription: string;
  masterPrompt: string;
  sourceImageUrl?: string;
  duration: ProDuration;
  ratio: ProRatio;
  style: ProStyle;
  subtitleMode: SubtitleMode;
  voiceMode: VoiceMode;
  musicMood: string;
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
