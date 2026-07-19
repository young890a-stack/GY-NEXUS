import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStorageSegment } from "@/lib/creative-studio/storage";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 500 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as { fileName?: string; contentType?: string; size?: number };
    const contentType = String(body.contentType || "").toLowerCase();
    const extension = EXTENSIONS[contentType];
    const size = Number(body.size || 0);
    if (!extension) {
      return NextResponse.json({ success: false, message: "허가 영상은 MP4, WEBM, MOV 형식만 사용할 수 있습니다." }, { status: 400 });
    }
    if (size < 1 || size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, message: "허가 영상 파일은 500MB 이하여야 합니다." }, { status: 400 });
    }

    const bucket = process.env.CREATIVE_STORAGE_BUCKET || "creative-assets";
    const date = new Date().toISOString().slice(0, 10);
    const fileName = safeStorageSegment(String(body.fileName || "licensed-short"), "licensed-short");
    const path = `references/${date}/${Date.now()}-${fileName}.${extension}`;
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data?.token) throw error || new Error("서명 업로드 주소를 만들지 못했습니다.");
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);

    return NextResponse.json({ success: true, bucket, path, token: data.token, publicUrl: publicData.publicUrl });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "허가 영상 업로드 준비에 실패했습니다.",
    }, { status: 500 });
  }
}
