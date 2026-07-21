import { NextResponse } from "next/server";
import {
  generateKeywordPlanWithGemini,
  getGeminiDiscoveryApiKey,
  getGeminiDiscoveryModel,
  keywordPlanManualPrompt,
  validateKeywordPlan,
} from "@/lib/shorts-intelligence-v3/gemini-discovery";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const query = String(body.query || "").replace(/\s+/g, " ").trim();
    const mode = String(body.mode || "auto");
    if (query.length < 2 || query.length > 120) {
      return NextResponse.json({ success: false, message: "상품명을 2~120자로 입력해주세요." }, { status: 400 });
    }
    if (mode === "manual-import") {
      const plan = validateKeywordPlan(body.plan);
      return NextResponse.json({ success: true, provider: "gemini-pro-manual", model: "Gemini Pro app", plan });
    }
    if (!getGeminiDiscoveryApiKey()) {
      return NextResponse.json({
        success: false,
        code: "GEMINI_API_KEY_REQUIRED",
        message: "Gemini Pro 직접 사용 모드로 검색어를 만든 뒤 JSON 결과를 붙여 넣어주세요.",
        manualPrompt: keywordPlanManualPrompt(query),
      }, { status: 409 });
    }
    const plan = await generateKeywordPlanWithGemini(query);
    return NextResponse.json({ success: true, provider: "gemini-api", model: getGeminiDiscoveryModel(), plan });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Gemini 검색어를 만들지 못했습니다." }, { status: 500 });
  }
}
