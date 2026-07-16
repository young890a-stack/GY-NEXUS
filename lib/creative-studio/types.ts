export type CreativeAssetKind = "thumbnail" | "blog" | "shorts_cover" | "video";
export type CreativeJobStatus = "queued" | "processing" | "completed" | "failed";
export type ImageAspect = "1024x1024" | "1536x1024" | "1024x1536";

export type ImageRequest = {
  title: string;
  prompt: string;
  kind: Exclude<CreativeAssetKind, "video">;
  size: ImageAspect;
  transparent?: boolean;
};

export type VideoRequest = {
  title: string;
  prompt: string;
  sourceImageUrl?: string;
  duration: 5 | 10;
  ratio: "720:1280" | "1280:720";
};
