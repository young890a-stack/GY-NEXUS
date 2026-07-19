import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildStoragePath, uploadBuffer } from "@/lib/creative-studio/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as { voice?: string };
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const { data: scenes, error: sceneError } = await supabase
      .from("video_scenes")
      .select("narration")
      .eq("project_id", id)
      .order("scene_number");
    if (sceneError) throw sceneError;

    const settings = record(project.settings);
    const commercePackage = record(settings.commercePackage);
    const fallback = (scenes || []).map((scene) => String(scene.narration || "").trim()).filter(Boolean).join(" ");
    const script = String(commercePackage.voiceover || fallback).trim();
    if (!script) throw new Error("먼저 쇼핑 대본을 생성해주세요.");

    const allowed = new Set(["marin", "coral", "shimmer", "cedar", "onyx", "echo"]);
    const defaultVoice = project.voice_mode === "male"
      ? process.env.OPENAI_TTS_VOICE_MALE || "cedar"
      : process.env.OPENAI_TTS_VOICE_FEMALE || "marin";
    const voice = allowed.has(body.voice || "") ? String(body.voice) : defaultVoice;
    const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const speech = await openai.audio.speech.create({
      model,
      voice,
      input: script.slice(0, 4096),
      response_format: "mp3",
      instructions: "한국어 쇼핑 쇼츠 내레이션. 또렷하고 자연스럽게, 과장된 홈쇼핑 톤은 피하고 20~40대에게 신뢰감 있게 말한다.",
    });
    const path = buildStoragePath({ folder: "videos", title: `${project.title}-voice`, extension: "mp3" });
    const audioUrl = await uploadBuffer({
      buffer: Buffer.from(await speech.arrayBuffer()),
      path,
      contentType: "audio/mpeg",
    });
    const nextSettings = {
      ...settings,
      voiceAudioUrl: audioUrl,
      voiceModel: model,
      voiceName: voice,
      voiceUpdatedAt: new Date().toISOString(),
    };
    const { error: updateError } = await supabase.from("video_projects").update({
      settings: nextSettings,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, audioUrl, model, voice });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "AI 음성 생성에 실패했습니다.",
    }, { status: 500 });
  }
}
