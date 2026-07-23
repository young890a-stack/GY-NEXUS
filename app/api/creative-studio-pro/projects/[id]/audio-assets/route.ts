import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStorageSegment, uploadBuffer } from "@/lib/creative-studio/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_FILES = 8;
const ALLOWED_MIME = new Map([
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/mp4", "m4a"],
  ["audio/x-m4a", "m4a"],
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    return NextResponse.json({
      success: true,
      assets: Array.isArray(settings.audioAssets) ? settings.audioAssets : [],
      timeline: record(settings.audioTimeline),
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "오디오 소재 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const form = await request.formData();
    const kind = String(form.get("kind") || "music");
    if (!new Set(["music", "sfx"]).has(kind)) {
      return NextResponse.json({ success: false, message: "오디오 종류가 올바르지 않습니다." }, { status: 400 });
    }

    const files = form.getAll("files").filter((value): value is File => value instanceof File).slice(0, MAX_FILES);
    if (!files.length) return NextResponse.json({ success: false, message: "음원 파일을 선택해주세요." }, { status: 400 });

    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("title,settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");

    const date = new Date().toISOString().slice(0, 10);
    const uploaded = [] as Array<Record<string, unknown>>;
    for (const file of files) {
      if (!ALLOWED_MIME.has(file.type)) throw new Error(`${file.name}: MP3, WAV, M4A 파일만 사용할 수 있습니다.`);
      if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: 파일은 30MB 이하여야 합니다.`);
      const extension = ALLOWED_MIME.get(file.type) || "mp3";
      const cleanName = safeStorageSegment(file.name.replace(/\.[^.]+$/, ""), `${kind}-audio`);
      const objectPath = `videos/${date}/${Date.now()}-${kind}-${cleanName}.${extension}`;
      const url = await uploadBuffer({ buffer: Buffer.from(await file.arrayBuffer()), path: objectPath, contentType: file.type });
      uploaded.push({
        id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind,
        name: file.name,
        url,
        mimeType: file.type,
        sizeBytes: file.size,
        source: "user-upload",
        uploadedAt: new Date().toISOString(),
      });
    }

    const settings = record(project.settings);
    const currentAssets = Array.isArray(settings.audioAssets) ? settings.audioAssets : [];
    const nextSettings = {
      ...settings,
      audioAssets: [...currentAssets, ...uploaded].slice(-40),
      audioAssetsUpdatedAt: new Date().toISOString(),
    };
    const { error: updateError } = await supabase.from("video_projects").update({ settings: nextSettings, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, assets: uploaded, allAssets: nextSettings.audioAssets });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "오디오 업로드 실패" }, { status: 500 });
  }
}
