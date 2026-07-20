import { NextResponse } from "next/server";
import { safeStorageSegment, uploadBuffer } from "@/lib/creative-studio/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 40 * 1024 * 1024;
const ALLOWED = new Map([
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/mp4", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/ogg", "ogg"],
] as const);

type AllowedAudioType =
  | "audio/mpeg"
  | "audio/mp3"
  | "audio/wav"
  | "audio/x-wav"
  | "audio/mp4"
  | "audio/x-m4a"
  | "audio/ogg";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("audio");
    const purpose = String(form.get("purpose") || "voice") === "music" ? "music" : "voice";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "음성 또는 음악 파일을 선택해주세요." },
        { status: 400 },
      );
    }

    const extension = ALLOWED.get(file.type as AllowedAudioType);
    if (!extension) {
      return NextResponse.json(
        { success: false, message: "MP3, WAV, M4A, OGG 오디오만 사용할 수 있습니다." },
        { status: 400 },
      );
    }

    if (file.size < 1 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, message: "오디오 파일은 40MB 이하여야 합니다." },
        { status: 400 },
      );
    }

    const date = new Date().toISOString().slice(0, 10);
    const safeName = safeStorageSegment(
      `revenue-shorts-${purpose}-${file.name.replace(/\.[^.]+$/, "")}`,
      `revenue-shorts-${purpose}`,
    );
    const path = `videos/${date}/${Date.now()}-${safeName}.${extension}`;

    const audioUrl = await uploadBuffer({
      buffer: Buffer.from(await file.arrayBuffer()),
      path,
      contentType: file.type,
    });

    return NextResponse.json({
      success: true,
      audioUrl,
      purpose,
      extension,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "오디오 업로드에 실패했습니다.",
    }, { status: 500 });
  }
}
