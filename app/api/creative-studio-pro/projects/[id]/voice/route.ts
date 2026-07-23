import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildStoragePath, uploadBuffer } from "@/lib/creative-studio/storage";

export const runtime = "nodejs";
export const maxDuration = 180;

const VOICES = new Set(["marin", "coral", "shimmer", "cedar", "onyx", "echo"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeSegment(value: unknown, index: number) {
  const item = record(value);
  const startSecond = Math.max(0, Number(item.startSecond) || index * 2);
  const endSecond = Math.max(startSecond + 0.2, Number(item.endSecond) || startSecond + 2);
  const voice = VOICES.has(String(item.voice || "")) ? String(item.voice) : "marin";
  return {
    id: String(item.id || `voice-${index + 1}`).slice(0, 80),
    startSecond,
    endSecond,
    text: String(item.text || "").trim().slice(0, 700),
    voice,
    speed: Math.max(0.75, Math.min(1.35, Number(item.speed) || 1)),
    volume: Math.max(0, Math.min(2, Number(item.volume) || 1)),
    delivery: String(item.delivery || "자연스럽고 또렷하게").trim().slice(0, 160),
    audioUrl: String(item.audioUrl || "").startsWith("https://") ? String(item.audioUrl) : "",
    updatedAt: String(item.updatedAt || ""),
  };
}

async function synthesize(openai: OpenAI, params: {
  model: string;
  voice: string;
  text: string;
  instructions: string;
  title: string;
}) {
  const speech = await openai.audio.speech.create({
    model: params.model,
    voice: params.voice as "marin" | "coral" | "shimmer" | "cedar" | "onyx" | "echo",
    input: params.text.slice(0, 4096),
    response_format: "mp3",
    instructions: params.instructions,
  });
  const path = buildStoragePath({ folder: "videos", title: params.title, extension: "mp3" });
  return uploadBuffer({
    buffer: Buffer.from(await speech.arrayBuffer()),
    path,
    contentType: "audio/mpeg",
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
    const { id } = await context.params;
    const body = record(await request.json().catch(() => ({})));
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("*").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");

    const settings = record(project.settings);
    if (!settings.contentApprovedAt) {
      return NextResponse.json({ success: false, message: "첫 3초 훅을 선택하고 콘텐츠 품질 승인을 완료한 뒤 AI 음성을 만들어주세요." }, { status: 400 });
    }

    const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const timeline = record(settings.audioTimeline);
    const savedSegments = (Array.isArray(timeline.voiceSegments) ? timeline.voiceSegments : []).map(normalizeSegment);
    const suppliedSegments = (Array.isArray(body.segments) ? body.segments : []).map(normalizeSegment).filter((item) => item.text);
    const requestedId = String(body.segmentId || "");
    const sourceSegments = suppliedSegments.length ? suppliedSegments : savedSegments;

    if (sourceSegments.length || requestedId) {
      const targets = requestedId
        ? sourceSegments.filter((segment) => segment.id === requestedId)
        : sourceSegments;
      if (!targets.length) throw new Error("생성할 음성 문장을 찾지 못했습니다.");

      const generated = [] as Array<ReturnType<typeof normalizeSegment>>;
      for (const segment of targets) {
        const audioUrl = await synthesize(openai, {
          model,
          voice: segment.voice,
          text: segment.text,
          title: `${project.title}-${segment.id}`,
          instructions: `한국어 쇼핑 쇼츠 내레이션. ${segment.delivery}. 발음은 또렷하고 자연스럽게, 과장된 홈쇼핑 톤은 피하고 20~40대에게 신뢰감 있게 말한다.`,
        });
        generated.push({ ...segment, audioUrl, updatedAt: new Date().toISOString() });
      }

      const generatedMap = new Map(generated.map((segment) => [segment.id, segment]));
      const base = sourceSegments.length ? sourceSegments : savedSegments;
      const merged = base.map((segment) => generatedMap.get(segment.id) || segment);
      for (const segment of generated) {
        if (!merged.some((item) => item.id === segment.id)) merged.push(segment);
      }

      const nextTimeline = {
        ...timeline,
        version: 2,
        voiceSegments: merged,
        updatedAt: new Date().toISOString(),
      };
      const nextSettings = {
        ...settings,
        audioTimeline: nextTimeline,
        voiceAudioUrl: null,
        voiceModel: model,
        voiceUpdatedAt: new Date().toISOString(),
      };
      const { error: updateError } = await supabase.from("video_projects").update({ settings: nextSettings, updated_at: new Date().toISOString() }).eq("id", id);
      if (updateError) throw updateError;
      return NextResponse.json({ success: true, mode: "segments", generated, voiceSegments: merged, timeline: nextTimeline, model });
    }

    const commercePackage = record(settings.commercePackage);
    const { data: scenes, error: sceneError } = await supabase.from("video_scenes").select("narration").eq("project_id", id).order("scene_number");
    if (sceneError) throw sceneError;
    const fallback = (scenes || []).map((scene: any) => String(scene.narration || "").trim()).filter(Boolean).join(" ");
    const script = String(commercePackage.voiceover || fallback).trim();
    if (!script) throw new Error("먼저 쇼핑 대본을 생성해주세요.");

    const defaultVoice = project.voice_mode === "male"
      ? process.env.OPENAI_TTS_VOICE_MALE || "cedar"
      : process.env.OPENAI_TTS_VOICE_FEMALE || "marin";
    const bodyVoice = String(body.voice || "");
    const voice = VOICES.has(bodyVoice) ? bodyVoice : defaultVoice;
    const audioUrl = await synthesize(openai, {
      model,
      voice,
      text: script,
      title: `${project.title}-voice`,
      instructions: "한국어 쇼핑 쇼츠 내레이션. 또렷하고 자연스럽게, 과장된 홈쇼핑 톤은 피하고 20~40대에게 신뢰감 있게 말한다.",
    });
    const nextSettings = {
      ...settings,
      voiceAudioUrl: audioUrl,
      voiceModel: model,
      voiceName: voice,
      voiceUpdatedAt: new Date().toISOString(),
    };
    const { error: updateError } = await supabase.from("video_projects").update({ settings: nextSettings, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, mode: "single", audioUrl, model, voice });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "AI 음성 생성에 실패했습니다." }, { status: 500 });
  }
}
