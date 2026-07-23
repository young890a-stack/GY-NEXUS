import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const ALLOWED_FONTS = new Set([
  "gmarket-bold",
  "nanum-round",
  "cafe24-surround-air",
  "one-mobile-pop",
  "one-mobile-title",
  "esamanru-bold",
]);

const ALLOWED_STYLES = new Set(["lifehack", "deal", "it-info", "review"]);

function pickFont(value: unknown) {
  const text = String(value || "").trim();
  return ALLOWED_FONTS.has(text) ? text : "gmarket-bold";
}

function pickStyle(value: unknown) {
  const text = String(value || "").trim();
  return ALLOWED_STYLES.has(text) ? text : "lifehack";
}

function normalizeVariant(value: unknown, index: number) {
  const item = record(value);
  return {
    id: String(item.id || `thumb-${index + 1}`).slice(0, 80),
    title: String(item.title || "").trim().slice(0, 80),
    subtitle: String(item.subtitle || "").trim().slice(0, 120),
    badge: String(item.badge || "").trim().slice(0, 30),
    fontPreset: pickFont(item.fontPreset),
    layout: String(item.layout || "상단 메인 + 하단 상품 강조").trim().slice(0, 120),
    canvas: String(item.canvas) === "1280x720" ? "1280x720" : "1080x1920",
    accent: String(item.accent || "민트·옐로 포인트").trim().slice(0, 60),
  };
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    const thumbnailPackage = record(settings.thumbnailPackage);
    return NextResponse.json({ success: true, thumbnailPackage });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "썸네일 패키지 조회 실패" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = record(await request.json());
    const nextPackage = {
      styleProfile: pickStyle(body.styleProfile),
      fontPreset: pickFont(body.fontPreset),
      subtitlePreset: pickFont(body.subtitlePreset),
      mainText: String(body.mainText || "").trim().slice(0, 80),
      subText: String(body.subText || "").trim().slice(0, 120),
      badgeText: String(body.badgeText || "").trim().slice(0, 30),
      variants: (Array.isArray(body.variants) ? body.variants : []).slice(0, 8).map(normalizeVariant),
      miricanvasGuide: (Array.isArray(body.miricanvasGuide) ? body.miricanvasGuide : []).slice(0, 12).map((item) => String(item).trim().slice(0, 160)).filter(Boolean),
      updatedAt: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    const nextSettings = {
      ...settings,
      thumbnailPackage: nextPackage,
      subtitleStyle: nextPackage.subtitlePreset,
      thumbnailStyle: nextPackage.fontPreset,
    };
    const { error: updateError } = await supabase.from("video_projects").update({
      settings: nextSettings,
      updated_at: nextPackage.updatedAt,
    }).eq("id", id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, thumbnailPackage: nextPackage, message: "미리캔버스 썸네일 패키지를 저장했습니다." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "썸네일 패키지 저장 실패" }, { status: 500 });
  }
}
