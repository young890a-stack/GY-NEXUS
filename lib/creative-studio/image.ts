import OpenAI, { toFile } from "openai";
import { buildStoragePath, uploadBuffer } from "./storage";
import { assertPublicHttpsUrl } from "@/lib/security/public-url";
import type {
  GeneratedImageCandidate,
  ImageRequest,
  ReferenceImageCandidateRequest,
} from "./types";

const MAX_REFERENCE_BYTES = 12 * 1024 * 1024;
const supportedFinalSizes = new Set(["1024x1824", "1024x1536", "2160x3840"]);

function premiumFinalImageSize() {
  const configured = process.env.SHORTS_FINAL_IMAGE_SIZE?.trim() || "2160x3840";
  return supportedFinalSizes.has(configured) ? configured : "2160x3840";
}

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
  if (input.referenceImageUrls.length < 1) throw new Error("상품 참조 이미지가 최소 1장 필요합니다.");

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const continuityUrls = input.continuityImageUrls?.slice(0, 1) || [];
  const referenceFiles = await Promise.all(
    [...input.referenceImageUrls.slice(0, 4), ...continuityUrls]
      .map((url, index) => downloadReferenceImage(url, index)),
  );
  const prompt = [
    input.prompt,
    `입력 이미지 1~${Math.min(input.referenceImageUrls.length, 4)}는 실제 상품의 절대 사실 기준이다.`,
    continuityUrls.length
      ? "마지막 입력 이미지는 직전 승인 장면의 연속성 기준이다. 상품과 인물의 정체성, 조명과 색감만 이어가고 새 장면의 행동과 구도는 장면 지시를 따른다."
      : "첫 장면이므로 실제 상품 사진의 정체성을 최우선으로 유지한다.",
    "실제 상품의 색상·실루엣·재질·버튼·포트·구성품·로고를 추가, 삭제, 이동, 변형하지 않는다.",
    "제품을 녹이거나 휘게 만들지 말고, 손과 관절은 실제 인체 구조로 만든다.",
    "세로 화면 위아래 12%는 자막과 플랫폼 UI를 위한 여백으로 두고, 핵심 상품은 중앙 안전영역에 선명하게 배치한다.",
  ].join("\n");
  const response = await openai.images.edit({
    model,
    image: referenceFiles,
    prompt,
    n: input.count || 3,
    quality: input.quality || "medium",
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
  continuityImageUrls?: string[];
  draftImageUrl: string;
}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const continuityUrls = input.continuityImageUrls?.slice(0, 1) || [];
  const urls = [...input.referenceImageUrls.slice(0, 4), ...continuityUrls, input.draftImageUrl];
  const files = await Promise.all(urls.map((url, index) => downloadReferenceImage(url, index)));
  const response = await openai.images.edit({
    model,
    image: files,
    prompt: [
      input.prompt,
      `입력 이미지 1~${Math.min(input.referenceImageUrls.length, 4)}는 실제 상품의 절대 사실 기준이다.`,
      continuityUrls.length
        ? "그 다음 이미지는 직전 승인 장면의 인물·조명·색감 연속성 기준이다."
        : "직전 장면 기준은 없으며 첫 장면의 일관된 광고 스타일을 만든다.",
      "마지막 이미지는 검수를 통과한 구도 초안이다. 구도만 활용하고 상품 정체성은 실제 상품 사진을 따른다.",
      "상품의 색상, 형태, 버튼, 포트, 구성품, 재질, 로고와 비율을 절대 바꾸지 않는다.",
      "새 글자, 가격, 로고, 인증마크, 구성품 또는 장식 요소를 만들지 않는다.",
      "손가락과 관절을 정상적으로 유지하고 제품 경계가 손이나 배경과 녹아들지 않게 한다.",
      "실제 프리미엄 상업 촬영처럼 자연스럽게 마감하되 과도한 광택, 효능 암시, 비현실적 효과를 넣지 않는다.",
      "세로 화면 위아래 12%는 자막과 플랫폼 UI를 위한 깨끗한 여백으로 유지한다.",
    ].join("\n"),
    n: 1,
    quality: "high",
    size: premiumFinalImageSize(),
    ...(!model.startsWith("gpt-image-2") ? { input_fidelity: "high" as const } : {}),
    background: "opaque",
    output_format: "jpeg",
    output_compression: 96,
  });
  const [candidate] = await persistGeneratedImages(response.data || [], `${input.title}-final`);
  if (!candidate) throw new Error("최종 고품질 이미지를 만들지 못했습니다.");
  return { model, image: candidate };
}
