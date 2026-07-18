import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { finalizeMemberUsage, getMemberAccess, reserveMemberUsage } from "@/lib/subscriptions/access";

type TitleIdeas = { titles: string[]; angle: string; caution: string };

function parseIdeas(raw: string): TitleIdeas {
  const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(clean) as Partial<TitleIdeas>;
  const titles = Array.isArray(parsed.titles) ? parsed.titles.map(String).map((v) => v.trim()).filter(Boolean).slice(0, 7) : [];
  if (!titles.length) throw new Error("AI가 제목 아이디어를 만들지 못했습니다.");
  return { titles, angle: String(parsed.angle || "독자의 문제 해결"), caution: String(parsed.caution || "과장 표현과 사실 확인이 안 된 주장은 사용하지 마세요.") };
}

export async function POST(request: Request) {
  let usageEventId: string | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

    const body = (await request.json()) as { topic?: unknown; audience?: unknown };
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 200) : "";
    const audience = typeof body.audience === "string" ? body.audience.trim().slice(0, 100) : "";
    if (topic.length < 2) return NextResponse.json({ message: "주제를 두 글자 이상 입력해주세요." }, { status: 400 });

    const access = await getMemberAccess(user.id);
    if (access.setupRequired) {
      return NextResponse.json({ message: "회원 AI 기반 설치가 아직 완료되지 않았습니다. 대표가 Production 2.0 SQL을 먼저 적용해야 합니다." }, { status: 503 });
    }
    if (access.remaining < 1) {
      return NextResponse.json({ message: "이번 달 AI 사용량을 모두 사용했습니다.", code: "quota_exceeded", access }, { status: 429 });
    }

    usageEventId = await reserveMemberUsage(user.id);
    if (!usageEventId) {
      return NextResponse.json({ message: "이번 달 AI 사용량을 모두 사용했습니다.", code: "quota_exceeded" }, { status: 429 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("회원 AI가 아직 연결되지 않았습니다.");

    const openai = new OpenAI({ apiKey });
    const prompt = `GY 회원을 위한 한국어 콘텐츠 제목 기획자다.\n주제: ${topic}\n대상 독자: ${audience || "일반 독자"}\n클릭만 노린 허위·공포·수익 보장 표현은 금지한다. 서로 다른 관점의 구체적인 제목 7개를 만든다. 반드시 JSON만 반환한다: {"titles":[""],"angle":"핵심 전략","caution":"사실 확인 주의점"}`;
    const response = await openai.responses.create({
      model: process.env.OPENAI_MEMBER_MODEL?.trim() || "gpt-5.6-luna",
      input: prompt,
      safety_identifier: user.id,
    });
    const ideas = parseIdeas(response.output_text?.trim() || "");
    await finalizeMemberUsage(usageEventId, true, { tool: "title_ideas", model: process.env.OPENAI_MEMBER_MODEL?.trim() || "gpt-5.6-luna" });

    return NextResponse.json({ success: true, ideas, access: { ...access, used: access.used + 1, remaining: Math.max(0, access.remaining - 1) } });
  } catch (error) {
    if (usageEventId) {
      try {
        await finalizeMemberUsage(usageEventId, false, { error: error instanceof Error ? error.message : "unknown" });
      } catch (finalizeError) {
        console.error("Usage refund failed:", finalizeError);
      }
    }
    console.error("Member title ideas failed:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "AI 제목 생성에 실패했습니다." }, { status: 500 });
  }
}
