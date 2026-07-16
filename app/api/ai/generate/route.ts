import { NextResponse } from "next/server";
import { generateAiContent } from "@/lib/ai/generate";
import type { ContentKind } from "@/lib/ai/prompts";

const allowedKinds: ContentKind[] = ["blog", "shorts", "bundle"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const kind = body.kind as ContentKind;

    if (!title) {
      return NextResponse.json(
        { success: false, message: "상품명을 입력해주세요." },
        { status: 400 }
      );
    }
    if (!allowedKinds.includes(kind)) {
      return NextResponse.json(
        { success: false, message: "지원하지 않는 콘텐츠 형식입니다." },
        { status: 400 }
      );
    }

    const content = await generateAiContent({ kind, title, description });
    return NextResponse.json({ success: true, content });
  } catch (error) {
    console.error("AI 생성 오류:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "AI 생성에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
