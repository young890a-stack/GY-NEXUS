import OpenAI from "openai";
import { buildStoragePath, uploadBuffer } from "./storage";
import type { ImageRequest } from "./types";

export async function generateCreativeImage(input: ImageRequest) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 없습니다.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const response = await openai.images.generate({
    model,
    prompt: `${input.prompt}\n\n브랜드: GY-NEXUS. 상업용 콘텐츠로 깔끔하고 신뢰감 있게. 이미지 안의 글자는 최소화하고 한글 오탈자를 만들지 말 것.`,
    size: input.size,
    quality: "high",
    background: input.transparent ? "transparent" : "opaque",
  });

  const item = response.data?.[0];
  if (!item) throw new Error("이미지 생성 결과가 없습니다.");

  const path = buildStoragePath({
    folder: "images",
    title: input.title,
    extension: "png",
  });

  let assetUrl = "";

  if (item.b64_json) {
    assetUrl = await uploadBuffer({
      buffer: Buffer.from(item.b64_json, "base64"),
      path,
      contentType: "image/png",
    });
  } else if (item.url) {
    const remote = await fetch(item.url, { cache: "no-store" });
    if (!remote.ok) {
      throw new Error(`생성 이미지 다운로드에 실패했습니다: ${remote.status}`);
    }

    assetUrl = await uploadBuffer({
      buffer: Buffer.from(await remote.arrayBuffer()),
      path,
      contentType: remote.headers.get("content-type") || "image/png",
    });
  }

  if (!assetUrl) throw new Error("이미지 URL을 확보하지 못했습니다.");

  return {
    provider: "openai",
    model,
    assetUrl,
    revisedPrompt: item.revised_prompt || null,
    storagePath: path,
  };
}
