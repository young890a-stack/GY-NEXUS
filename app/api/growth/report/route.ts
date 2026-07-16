import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const input = await request.json();
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY가 없습니다." }, { status: 400 });
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content:
            "너는 GY-NEXUS의 Dream Y 성장 분석 책임자다. 제공된 Search Console과 GA4 데이터를 근거로 과장 없이 한국어 경영 보고서를 작성한다. 반드시 핵심 요약, 발견한 기회, 위험 신호, 오늘 실행할 일 3개, 다음 7일 계획 순서로 작성한다.",
        },
        { role: "user", content: JSON.stringify(input) },
      ],
    });
    return NextResponse.json({ ok: true, report: completion.choices[0]?.message?.content || "분석 결과가 없습니다." });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "AI 성장 보고서 생성 실패" },
      { status: 500 }
    );
  }
}
