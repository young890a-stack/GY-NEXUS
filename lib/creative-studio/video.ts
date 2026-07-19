import RunwayML from "@runwayml/sdk";
import { buildStoragePath, persistRemoteAsset } from "./storage";
import type { VideoRequest } from "./types";

function normalizeSourceImageUrl(value?: string) {
  const url = value?.trim();
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("장면 이미지 URL 형식이 올바르지 않습니다.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("장면 이미지는 외부에서 접근 가능한 HTTPS URL이어야 합니다.");
  }

  return parsed.toString();
}

export async function generateCreativeVideo(input: VideoRequest) {
  if (!process.env.RUNWAYML_API_SECRET) {
    throw new Error(
      "RUNWAYML_API_SECRET가 없습니다. Runway 개발자 API 키를 연결해주세요.",
    );
  }

  const promptText = input.prompt.trim();
  if (!promptText) throw new Error("영상 프롬프트를 입력해주세요.");

  const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET });
  const model = process.env.RUNWAY_VIDEO_MODEL || "gen4.5";
  const sourceImageUrl = normalizeSourceImageUrl(input.sourceImageUrl);

  // imageToVideo requires promptImage. When no image is supplied, use the
  // dedicated textToVideo endpoint instead of passing promptImage: undefined.
  const task = sourceImageUrl
    ? await client.imageToVideo
        .create({
          model: model as "gen4.5",
          promptText,
          promptImage: sourceImageUrl,
          ratio: input.ratio,
          duration: input.duration,
        })
        .waitForTaskOutput({ timeout: 600000 })
    : await client.textToVideo
        .create({
          model: model as "gen4.5",
          promptText,
          ratio: input.ratio,
          duration: input.duration,
        })
        .waitForTaskOutput({ timeout: 600000 });

  const output = Array.isArray(task.output) ? task.output[0] : undefined;
  if (!output) throw new Error("영상 생성 결과가 없습니다.");

  const path = buildStoragePath({
    folder: "videos",
    title: input.title,
    extension: "mp4",
  });

  let assetUrl = output;
  try {
    assetUrl = await persistRemoteAsset(output, path, "video/mp4");
  } catch (error) {
    // Runway output remains usable even if the optional Supabase copy fails.
    console.warn("VIDEO STORAGE WARNING", error);
  }

  return {
    provider: "runway",
    model,
    generationMode: sourceImageUrl ? "image-to-video" : "text-to-video",
    taskId: task.id,
    assetUrl,
    providerUrl: output,
    storagePath: assetUrl === output ? null : path,
  };
}
