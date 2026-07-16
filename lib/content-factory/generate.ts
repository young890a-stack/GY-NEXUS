import OpenAI from "openai";
import { buildContentFactoryPrompt } from "@/lib/content-factory/prompt";
import type { ContentFactoryPackage, FactoryInput } from "@/lib/content-factory/types";

function extractJson(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
  return trimmed.slice(start, end + 1);
}

export async function generateContentFactoryPackage(input: FactoryInput): Promise<ContentFactoryPackage> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    input: buildContentFactoryPrompt(input),
  });
  const raw = response.output_text?.trim();
  if (!raw) throw new Error("AI가 콘텐츠 패키지를 생성하지 못했습니다.");
  try {
    return JSON.parse(extractJson(raw)) as ContentFactoryPackage;
  } catch (error) {
    console.error("CONTENT FACTORY JSON PARSE ERROR", raw);
    throw new Error(error instanceof Error ? `콘텐츠 구조화에 실패했습니다: ${error.message}` : "콘텐츠 구조화에 실패했습니다.");
  }
}
