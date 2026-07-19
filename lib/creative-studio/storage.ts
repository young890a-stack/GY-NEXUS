import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = process.env.CREATIVE_STORAGE_BUCKET || "creative-assets";

/**
 * Supabase Storage object keys are kept ASCII-only to prevent Invalid key errors
 * caused by Korean titles, spaces, query strings, or unsupported symbols.
 */
export function safeStorageSegment(value: string, fallback = "asset") {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 60);

  return cleaned || fallback;
}

export function buildStoragePath(params: {
  folder: "images" | "videos" | "references";
  title: string;
  extension: "png" | "jpg" | "webp" | "mp4" | "mp3";
}) {
  const date = new Date().toISOString().slice(0, 10);
  const name = safeStorageSegment(
    params.title,
    params.folder === "videos" ? "gy-nexus-video" : "gy-nexus-image",
  );

  return `${params.folder}/${date}/${Date.now()}-${name}.${params.extension}`;
}

export async function uploadBuffer(params: {
  buffer: Buffer;
  path: string;
  contentType: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(params.path, params.buffer, {
      contentType: params.contentType,
      cacheControl: "31536000",
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(params.path);
  if (!data.publicUrl) {
    throw new Error("Supabase Storage 공개 URL을 만들지 못했습니다.");
  }

  return data.publicUrl;
}

export async function persistRemoteAsset(
  url: string,
  path: string,
  contentType: string,
  maxBytes = 60 * 1024 * 1024,
) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`원격 파일 다운로드 실패: ${response.status}`);
  }

  const length = Number(response.headers.get("content-length") || "0");
  if (length && length > maxBytes) return url;

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) return url;

  return uploadBuffer({
    buffer: Buffer.from(arrayBuffer),
    path,
    contentType,
  });
}
