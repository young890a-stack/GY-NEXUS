import OpenAI from "openai";
import { classifyOpenAIError, openAIUserError } from "@/lib/ai/openai-error";
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
  let lastFailure: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5.5",
        input: buildContentFactoryPrompt(input),
        max_output_tokens: attempt === 0 ? 7000 : 10000,
      });
      const raw = response.output_text?.trim();
      if (!raw) throw new Error("AI가 콘텐츠 패키지를 생성하지 못했습니다.");
      return JSON.parse(extractJson(raw)) as ContentFactoryPackage;
    } catch (error) {
      const providerFailure = classifyOpenAIError(error);
      if (providerFailure && !providerFailure.retryable) throw providerFailure.userError;
      lastFailure = error;
      console.warn("CONTENT FACTORY AUTO RETRY", { attempt: attempt + 1, message: error instanceof Error ? error.message : String(error) });
    }
  }
  const providerFailure = openAIUserError(lastFailure);
  if (providerFailure) throw providerFailure;
  throw new Error(lastFailure instanceof Error
    ? `Dream Y가 잘린 콘텐츠 응답을 자동 재시도했지만 복구하지 못했습니다: ${lastFailure.message}`
    : "Dream Y가 콘텐츠 구조를 자동 복구하지 못했습니다.");
}
