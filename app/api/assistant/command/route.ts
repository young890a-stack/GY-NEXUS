import OpenAI from "openai";
import { NextResponse } from "next/server";
import { selectAssistantActions } from "@/lib/assistant/tools";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { command?: string };
    const command = body.command?.trim();
    if (!command) return NextResponse.json({ success: false, message: "명령을 입력해주세요." }, { status: 400 });

    const actions = selectAssistantActions(command);
    let summary = "요청을 실행 가능한 단계로 정리했습니다. 게시·예약 작업은 대표 승인 후 진행합니다.";
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (apiKey) {
      const openai = new OpenAI({ apiKey });
      const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5.5",
        input: `당신은 GY-NEXUS 운영 비서입니다. 사용자의 명령을 3문장 이내의 한국어 실행 계획으로 바꾸세요. 과장된 수익 보장은 금지하고, 외부 게시나 결제성 작업은 대표 승인 필요라고 명시하세요.\n\n명령: ${command}`,
      });
      summary = response.output_text?.trim() || summary;
    }

    return NextResponse.json({ success: true, summary, actions, approvalRequired: actions.some((item) => item.risk === "approval") });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "AI 비서가 계획을 만들지 못했습니다." }, { status: 500 });
  }
}
