import OpenAI from "openai";
import { analyzeSeoLocally } from "@/lib/seo/local-analyzer";
import type { SeoInput, SeoReport } from "@/lib/seo/types";

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
  return cleaned.slice(start, end + 1);
}

export async function generateSeoReport(input: SeoInput): Promise<SeoReport> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  const localScores = analyzeSeoLocally(input);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `당신은 Google Search 품질 원칙을 따르는 한국어 SEO 편집자이자 쇼츠 기획자입니다. 과장, 허위 검색량, 키워드 도배를 금지합니다.\n\n제목: ${input.title}\n핵심 키워드: ${input.primaryKeyword}\n타깃: ${input.targetAudience || "20~40대 일반 사용자"}\nURL: ${input.contentUrl || "미게시"}\n규칙 기반 점수: ${JSON.stringify(localScores)}\n본문:\n${input.content.slice(0, 18000)}\n\n아래 JSON만 반환하세요. scores는 제공된 점수를 그대로 사용하세요.\n{\n "scores": ${JSON.stringify(localScores)},\n "metaTitle":"55자 이내",\n "metaDescription":"120~155자",\n "keywords":["관련 키워드 8~12개"],\n "headings":["H2/H3 제안 6~10개"],\n "faq":[{"question":"질문","answer":"구체적인 답변"}],\n "internalLinkIdeas":["내부링크 주제 4개"],\n "altTexts":["이미지 대체텍스트 3개"],\n "improvements":["우선순위가 높은 개선사항 5~8개"],\n "strengths":["잘된 점 3~5개"],\n "shorts":{"title":"쇼츠 제목","hook":"0~3초 훅","script":"15~30초 자연스러운 한국어 대본","cta":"행동 유도","description":"설명","hashtags":["해시태그"]},\n "thumbnails":[\n  {"label":"A","headline":"짧은 문구","subline":"보조 문구","visualDirection":"구도 설명","predictedCtr":0},\n  {"label":"B","headline":"짧은 문구","subline":"보조 문구","visualDirection":"구도 설명","predictedCtr":0},\n  {"label":"C","headline":"짧은 문구","subline":"보조 문구","visualDirection":"구도 설명","predictedCtr":0}\n ]\n}`;
  const response = await openai.responses.create({ model: process.env.OPENAI_MODEL || "gpt-5.5", input: prompt });
  const raw = response.output_text?.trim();
  if (!raw) throw new Error("SEO 분석 결과가 비어 있습니다.");
  return JSON.parse(extractJson(raw)) as SeoReport;
}
