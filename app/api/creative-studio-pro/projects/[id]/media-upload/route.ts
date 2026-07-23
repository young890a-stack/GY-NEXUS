import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStorageSegment } from "@/lib/creative-studio/storage";

export const runtime = "nodejs";

const BUCKET = process.env.CREATIVE_STORAGE_BUCKET || "creative-assets";
const ALLOWED = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { fileName?: string; mimeType?: string; sizeBytes?: number };
    const fileName = String(body.fileName || "owned-video.mp4");
    const mimeType = String(body.mimeType || "video/mp4").toLowerCase();
    const sizeBytes = Math.max(0, Number(body.sizeBytes) || 0);
    if (!ALLOWED.has(mimeType)) return NextResponse.json({ success: false, message: "MP4, WEBM, MOV 영상만 업로드할 수 있습니다." }, { status: 400 });
    if (!sizeBytes || sizeBytes > 500 * 1024 * 1024) return NextResponse.json({ success: false, message: "영상 파일은 500MB 이하만 업로드할 수 있습니다." }, { status: 400 });

    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase.from("video_projects").select("id").eq("id", id).single();
    if (projectError || !project) throw projectError || new Error("프로젝트를 찾을 수 없습니다.");

    const extension = mimeType === "video/webm" ? "webm" : mimeType === "video/quicktime" ? "mov" : "mp4";
    const clean = safeStorageSegment(fileName.replace(/\.[^.]+$/, ""), "owned-video");
    const path = `references/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${clean}.${extension}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (error || !data) throw error || new Error("영상 업로드 주소를 만들지 못했습니다.");
    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
      || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
      || process.env.SUPABASE_ANON_KEY?.trim()
      || "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || "";

    return NextResponse.json({
      success: true,
      bucket: BUCKET,
      path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: publicData.publicUrl,
      supabaseUrl,
      anonKey,
      mimeType,
      sizeBytes,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "영상 업로드 준비 실패" }, { status: 500 });
  }
}
