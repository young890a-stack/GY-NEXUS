import OpenAI, { toFile } from "openai";
import { buildStoragePath, uploadBuffer } from "./storage";
import { assertPublicHttpsUrl } from "@/lib/security/public-url";
import type {
  GeneratedImageCandidate,
  ImageRequest,
  ReferenceImageCandidateRequest,
} from "./types";

const MAX_REFERENCE_BYTES = 12 * 1024 * 1024;

async function downloadReferenceImage(url: string, index: number) {
  const safeUrl = await assertPublicHttpsUrl(url);
  const response = await fetch(safeUrl, { cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error(`상품 참조 이미지 ${index + 1} 다운로드 실패: ${response.status}`);

  const contentType = response.headers.get("content-type")?.split(";")[0] || "";
  if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(contentType)) {
    throw new Error(`상품 참조 이미지 ${index + 1} 형식을 PNG, JPG 또는 WEBP로 올려주세요.`);
  }

  const declaredSize = Number(response.headers.get("content-length") || "0");
  if (declaredSize > MAX_REFERENCE_BYTES) {
    throw new Error(`상품 참조 이미지 ${index + 1}은 12MB 이하여야 합니다.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_REFERENCE_BYTES) {
    throw new Error(`상품 참조 이미지 ${index + 1}은 12MB 이하여야 합니다.`);
  }

  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return toFile(buffer, `product-reference-${index + 1}.${extension}`, { type: contentType });
}

async function persistGeneratedImages(
  items: Array<{ b64_json?: string; url?: string }>,
  title: string,
): Promise<GeneratedImageCandidate[]> {
  const results: GeneratedImageCandidate[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    let buffer: Buffer | null = item.b64_json ? Buffer.from(item.b64_json, "base64") : null;
    if (!buffer && item.url) {
      const response = await fetch(item.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`생성 이미지 ${index + 1} 다운로드 실패: ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
    }
    if (!buffer) continue;

    const path = buildStoragePath({
      folder: "images",
      title: `${title}-candidate-${index + 1}`,
      extension: "jpg",
    });
    const assetUrl = await uploadBuffer({ buffer, path, contentType: "image/jpeg" });
    results.push({ index, assetUrl, storagePath: path });
  }

  if (!results.length) throw new Error("이미지 생성 결과를 저장하지 못했습니다.");
  return results;
}

export async function generateCreativeImage(input: ImageRequest) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 없습니다.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const supportsTransparency = !model.startsWith("gpt-image-2");
  const response = await openai.images.generate({
    model,
    prompt: `${input.prompt}\n\n브랜드: GY-NEXUS. 상업용 콘텐츠로 깔끔하고 신뢰감 있게. 이미지 안의 글자는 최소화하고 한글 오탈자를 만들지 말 것.`,
    size: input.size,
    quality: "high",
    background: input.transparent && supportsTransparency ? "transparent" : "opaque",
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

export async function generateReferenceImageCandidates(input: ReferenceImageCandidateRequest) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
  if (!input.referenceImageUrls.length) throw new Error("상품 참조 이미지가 최소 1장 필요합니다.");

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const referenceFiles = await Promise.all(
    input.referenceImageUrls.slice(0, 4).map((url, index) => downloadReferenceImage(url, index)),
  );
  const response = await openai.images.edit({
    model,
    image: referenceFiles,
    prompt: input.prompt,
    n: input.count || 3,
    quality: input.quality || "low",
    size: input.size || "1024x1824",
    ...(!model.startsWith("gpt-image-2") ? { input_fidelity: "high" as const } : {}),
    background: "opaque",
    output_format: "jpeg",
    output_compression: 92,
  });

  return {
    model,
    candidates: await persistGeneratedImages(response.data || [], input.title),
  };
}

export async function finalizeReferenceImage(input: {
  title: string;
  prompt: string;
  referenceImageUrls: string[];
  draftImageUrl: string;
}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const urls = [...input.referenceImageUrls.slice(0, 4), input.draftImageUrl];
  const files = await Promise.all(urls.map((url, index) => downloadReferenceImage(url, index)));
  const response = await openai.images.edit({
    model,
    image: files,
    prompt: `${input.prompt}\n앞쪽 이미지들은 상품 사실 기준이며 마지막 이미지는 선택된 구도 초안이다. 상품의 색상, 형태, 구성품, 재질과 비율은 앞쪽 상품 기준을 정확히 유지하고 마지막 초안의 구도만 활용한다. 화면 안에 새로운 글자, 가격, 로고 또는 인증마크를 만들지 않는다. 실제 상업 촬영처럼 자연스럽고 과장 없이 완성한다.`,
    n: 1,
    quality: "high",
    size: "1024x1824",
    ...(!model.startsWith("gpt-image-2") ? { input_fidelity: "high" as const } : {}),
    background: "opaque",
    output_format: "jpeg",
    output_compression: 96,
  });
  const [candidate] = await persistGeneratedImages(response.data || [], `${input.title}-final`);
  if (!candidate) throw new Error("최종 고품질 이미지를 만들지 못했습니다.");
  return { model, image: candidate };
}
