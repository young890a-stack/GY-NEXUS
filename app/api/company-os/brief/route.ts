import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const overview = body?.overview || {};
    const localBrief = [
      "[Dream Y 대표 브리핑]",
      `운영 준비도: ${overview.readiness ?? 0}%`,
      `상품 ${overview.metrics?.products ?? 0}개 · 콘텐츠 ${overview.metrics?.contents ?? 0}개 · 제작물 ${overview.metrics?.creatives ?? 0}개`,
      `게시 대기 ${overview.metrics?.publishPending ?? 0}건 · 자동화 대기 ${overview.metrics?.automationPending ?? 0}건 · 실패 ${overview.metrics?.automationFailed ?? 0}건`,
      "오늘의 우선순위",
      ...(overview.nextActions || []).map((item: string, index: number) => `${index + 1}. ${item}`),
      "운영 원칙: 외부 게시 전 초안·비공개 검수를 유지하고, 실패 작업은 원인 확인 후 재실행합니다.",
    ].join("\n");

    let report = localBrief;
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.responses.create({
        model: process.env.OPENAI_TEXT_MODEL || "gpt-5-mini",
        input: `너는 GY-NEXUS의 운영 비서 Dream Y다. 아래 운영 현황을 바탕으로 한국어 대표 브리핑을 작성하라. 과장하지 말고, 핵심 요약 3줄, 위험 신호, 오늘 할 일 3개, 다음 7일 목표를 간결하게 작성하라.\n\n${JSON.stringify(overview)}`,
      });
      report = response.output_text?.trim() || localBrief;
    }

    try {
      const supabase = createAdminClient();
      await supabase.from("company_daily_briefs").insert({ report, snapshot: overview });
    } catch {
      // Migration 실행 전에도 브리핑 기능은 동작합니다.
    }

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "브리핑 생성 실패" }, { status: 500 });
  }
}
