import { NextResponse } from "next/server";
import { generateAiContent } from "@/lib/ai/generate";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ success: false, message: "상품명이 없습니다." }, { status: 400 });
    const shorts = await generateAiContent({ kind: "shorts", title, description: body.description });
    return NextResponse.json({ success: true, shorts, content: shorts });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "AI 쇼츠 생성 실패" }, { status: 500 });
  }
}
