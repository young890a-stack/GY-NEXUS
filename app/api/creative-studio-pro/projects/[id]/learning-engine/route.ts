import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function normalizeInsight(value: unknown, index: number) {
  const item = record(value);
  const area = ["hook", "thumbnail", "voice", "offer", "timing"].includes(String(item.area))
    ? String(item.area)
    : "hook";
  return {
    area,
    summary: String(item.summary || `인사이트 ${index + 1}`).trim().slice(0, 220),
    action: String(item.action || "다음 제작에 반영하세요.").trim().slice(0, 280),
  };
}

function normalize(body: Record<string, unknown>) {
  return {
    sourceChannel: ["youtube", "instagram", "manual"].includes(String(body.sourceChannel)) ? String(body.sourceChannel) : "youtube",
    views: clamp(body.views, 0, 100000000, 0),
    impressions: clamp(body.impressions, 0, 100000000, 0),
    ctr: clamp(body.ctr, 0, 100, 0),
    averageViewPercent: clamp(body.averageViewPercent, 0, 100, 0),
    clicks: clamp(body.clicks, 0, 100000000, 0),
    orders: clamp(body.orders, 0, 100000000, 0),
    revenue: clamp(body.revenue, 0, 100000000000, 0),
    spend: clamp(body.spend, 0, 100000000000, 0),
    saveRate: clamp(body.saveRate, 0, 100, 0),
    shareRate: clamp(body.shareRate, 0, 100, 0),
    hookStyle: String(body.hookStyle || "문제 해결형").trim().slice(0, 120),
    thumbnailStyle: String(body.thumbnailStyle || "생활 꿀템형").trim().slice(0, 120),
    publishedAt: String(body.publishedAt || "").slice(0, 40),
    lastUpdatedAt: new Date().toISOString(),
    insights: (Array.isArray(body.insights) ? body.insights : []).slice(0, 10).map(normalizeInsight),
  };
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    return NextResponse.json({ success: true, learningEngine: record(settings.learningEngine) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "학습 엔진 조회 실패" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = record(await request.json());
    const learningEngine = normalize(body);

    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from("video_projects").select("settings").eq("id", id).single();
    if (error || !project) throw error || new Error("프로젝트를 찾을 수 없습니다.");
    const settings = record(project.settings);
    const nextSettings = {
      ...settings,
      learningEngine,
      learningEngineUpdatedAt: learningEngine.lastUpdatedAt,
    };

    const { error: updateError } = await supabase.from("video_projects").update({
      settings: nextSettings,
      updated_at: learningEngine.lastUpdatedAt,
    }).eq("id", id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, learningEngine, message: "게시 성과·클릭·판매 학습 엔진을 저장했습니다." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "학습 엔진 저장 실패" }, { status: 500 });
  }
}
