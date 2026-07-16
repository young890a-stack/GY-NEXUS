import OpenAI from "openai";

export type ProductAnalysis = {
  score: number;
  confidence: number;
  summary: string;
  features: string[];
  advantages: string[];
  targetAudience: string;
  useCases: string[];
  sellingPoints: string[];
  seoKeywords: string[];
  contentAngles: string[];
  shortsHook: string;
  caution: string;
};

type ProductInput = {
  title: string;
  description?: string;
  platform?: string;
  priceText?: string;
  brand?: string;
  category?: string;
  sourceUrl?: string;
};

function stringArray(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit)
    : [];
}

export async function analyzeProduct(input: ProductInput): Promise<ProductAnalysis> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `너는 대한민국 제휴마케팅용 상품 리서치와 SEO 기획을 담당하는 분석가다.
제공된 사실만 사용하고, 확인되지 않은 성능·후기·판매량을 만들어내지 않는다.
정보가 부족한 항목은 추정이라고 밝히거나 보수적으로 평가한다.
반드시 마크다운 없이 유효한 JSON 하나만 출력한다.

[입력 정보]
상품명: ${input.title}
가격: ${input.priceText || "확인되지 않음"}
브랜드: ${input.brand || "확인되지 않음"}
카테고리: ${input.category || "확인되지 않음"}
플랫폼: ${input.platform || "기타"}
상품 설명: ${input.description || "제공되지 않음"}
원본 URL: ${input.sourceUrl || "제공되지 않음"}

[출력 JSON 구조]
{
  "score": 0부터 100 사이의 정수,
  "confidence": 입력 정보의 신뢰도와 충분성을 반영한 0부터 100 사이 정수,
  "summary": "상품의 핵심 가치와 콘텐츠 적합성을 2~3문장으로 요약",
  "features": ["확인 가능한 특징 1", "특징 2", "특징 3"],
  "advantages": ["소비자 관점의 장점 1", "장점 2", "장점 3"],
  "targetAudience": "가장 적합한 구매 대상과 이유",
  "useCases": ["추천 사용 상황 1", "사용 상황 2", "사용 상황 3"],
  "sellingPoints": ["광고에서 강조할 판매 포인트 1", "포인트 2", "포인트 3"],
  "seoKeywords": ["구매 의도가 있는 핵심 키워드 10개 이내"],
  "contentAngles": ["블로그·쇼츠 콘텐츠 각도 1", "각도 2", "각도 3"],
  "shortsHook": "15초 쇼츠의 첫 3초에 사용할 자연스러운 한 문장",
  "caution": "가격 변동, 옵션, 배송, 광고 고지 등 구매 전 확인할 사항"
}`;

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    input: prompt,
  });
  const raw = response.output_text?.trim();
  if (!raw) throw new Error("AI 분석 결과가 비어 있습니다.");
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error("AI 분석 결과를 JSON으로 해석하지 못했습니다. 다시 시도해주세요.");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
    confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0))),
    summary: String(parsed.summary || "").trim(),
    features: stringArray(parsed.features, 6),
    advantages: stringArray(parsed.advantages, 6),
    targetAudience: String(parsed.targetAudience || "").trim(),
    useCases: stringArray(parsed.useCases, 6),
    sellingPoints: stringArray(parsed.sellingPoints, 6),
    seoKeywords: stringArray(parsed.seoKeywords, 12),
    contentAngles: stringArray(parsed.contentAngles, 6),
    shortsHook: String(parsed.shortsHook || "").trim(),
    caution: String(parsed.caution || "").trim(),
  };
}
