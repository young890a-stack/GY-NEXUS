import OpenAI from "openai";
import { buildPrompt, type ContentKind } from "@/lib/ai/prompts";

export async function generateAiContent(input: {
  kind: ContentKind;
  title: string;
  description?: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    input: buildPrompt(input),
  });

  const content = response.output_text?.trim();
  if (!content) throw new Error("AI가 내용을 생성하지 못했습니다.");
  return content;
}
