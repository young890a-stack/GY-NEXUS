import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const VOICES = new Set(["marin", "coral", "shimmer", "cedar", "onyx", "echo"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function httpsUrl(value: unknown) {
  const text = String(value || "").trim();
  return text.startsWith("https://") ? text : "";
}

function normalizeSegment(value: unknown, index: number) {
  const item = record(value);
  const startSecond = clamp(item.startSecond, 0, 600, index * 2);
  const endSecond = clamp(item.endSecond, startSecond + 0.2, 600, startSecond + 2);
  const voice = VOICES.has(String(item.voice || "")) ? String(item.voice) : "marin";
  return {
    id: String(item.id || `voice-${index + 1}`).slice(0, 80),
    startSecond,
    endSecond,
    text: String(item.text || "").trim().slice(0, 700),
    voice,
    speed: clamp(item.speed, 0.75, 1.35, 1),
    volume: clamp(item.volume, 0, 2, 1),
    delivery: String(item.delivery || "자연스럽고 또렷하게").trim().slice(0, 160),
    audioUrl: httpsUrl(item.audioUrl),
    updatedAt: String(item.updatedAt || ""),
  };
}

function normalizeMusic(value: unknown) {
  const item = record(value);
  return {
    assetId: String(item.assetId || "").slice(0, 100),
    name: String(item.name || "").slice(0, 200),
    url: httpsUrl(item.url),
    volume: clamp(item.volume, 0, 1, 0.16),
    startSecond: clamp(item.startSecond, 0, 600, 0),
    fadeIn: clamp(item.fadeIn, 0, 10, 0.5),
    fadeOut: clamp(item.fadeOut, 0, 10, 1.2),
    loop: item.loop !== false,
    autoDuck: item.autoDuck !== false,
    licenseNote: String(item.licenseNote || "").slice(0, 400),
  };
}

function normalizeSfx(value: unknown, index: number) {
  const item = record(value);
  return {
    id: String(item.id || `sfx-${index + 1}`).slice(0, 100),
    assetId: String(item.assetId || "").slice(0, 100),
    name: String(item.name || "효과음").slice(0, 200),
    url: httpsUrl(item.url),
    startSecond: clamp(item.startSecond, 0, 600, 0),
    durationSeconds: clamp(item.durationSeconds, 0.1, 10, 2),
    volume: clamp(item.volume, 0, 2, 0.7),
  };
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    return NextResponse.json({ success: true, timeline: record(settings.audioTimeline), assets: Array.isArray(settings.audioAssets) ? settings.audioAssets : [] });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "오디오 타임라인 조회 실패" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = record(await request.json());
    const voiceSegments = (Array.isArray(body.voiceSegments) ? body.voiceSegments : []).slice(0, 24).map(normalizeSegment).filter((item) => item.text);
    const music = normalizeMusic(body.music);
    const sfxCues = (Array.isArray(body.sfxCues) ? body.sfxCues : []).slice(0, 24).map(normalizeSfx).filter((item) => item.url);
    const timeline = {
      version: 2,
      voiceMasterVolume: clamp(body.voiceMasterVolume, 0, 2, 1),
      voiceSegments,
      music,
      sfxCues,
      updatedAt: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    const nextSettings = {
      ...settings,
      audioTimeline: timeline,
      musicMood: String(body.musicMood || settings.musicMood || "bright-commerce"),
      sfxMode: String(body.sfxMode || settings.sfxMode || "recommended"),
      audioTimelineUpdatedAt: timeline.updatedAt,
    };
    const { error: updateError } = await supabase.from("video_projects").update({
      settings: nextSettings,
      render_approved: false,
      render_approved_at: null,
      updated_at: timeline.updatedAt,
    }).eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, timeline, message: "음성·음악·효과음 타임라인을 저장했습니다." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "오디오 타임라인 저장 실패" }, { status: 500 });
  }
}
