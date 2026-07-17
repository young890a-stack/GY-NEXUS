import { NextResponse } from "next/server";
import { createPipelinePlan, type PipelineInput } from "@/lib/v2/pipeline";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PipelineInput;
    if (!body.title?.trim()) {
      return NextResponse.json({ success: false, message: "상품명을 입력해주세요." }, { status: 400 });
    }
    const plan = createPipelinePlan(body);
    return NextResponse.json({ success: true, plan });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "파이프라인 계획 생성에 실패했습니다." }, { status: 500 });
  }
}
