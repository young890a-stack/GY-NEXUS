import OpenAI from "openai";
import type { DNACampaignInput, ProductDNA } from "./types";

const styleLabels: Record<DNACampaignInput["style"], string> = {
  "million-view": "조회수 중심의 빠른 문제 해결형",
  cinematic: "영화형 프리미엄 광고",
  emotional: "감성 브랜드 스토리",
  premium: "고급스럽고 신뢰도 높은 제품 광고",
  ugc: "자연스러운 생활 후기형 UGC",
};

export async function generateProductDNA(input: DNACampaignInput): Promise<ProductDNA> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY가 없습니다.");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const productName = input.productName?.trim() || input.title.trim();
  const description = input.productDescription?.trim() || input.description.trim();
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
    response_format: { type: "json_object" },
    temperature: 0.65,
    messages: [
      {
        role: "system",
        content: `너는 GY-NEXUS의 Dream Y Product DNA Engine이다. 제휴 상품을 분석해 완전히 새로운 광고 콘셉트와 콘텐츠를 만든다. 원본 페이지의 문장, 사진 구도, 브랜드 로고, 캐릭터, 패키지 그래픽을 복제하지 않는다. 확인되지 않은 가격, 할인율, 성능, 인증, 후기, 순위는 만들지 않는다. 일반적인 제품 특징과 사용 상황만 사용하며, 결과는 반드시 유효한 JSON 객체로 반환한다. 블로그는 자연스러운 한국어 정보형 HTML로 1200자 이상 작성하고 광고 고지 문구를 포함한다. 쇼츠는 ${input.duration}초이며 정확한 한국어 자막에 적합하게 구성한다.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          productName,
          description,
          priceText: input.priceText,
          platform: input.platform,
          targetAudience: input.targetAudience || "20~40대",
          campaignStyle: styleLabels[input.style],
          affiliateDisclosure: input.affiliateDisclosure || "이 글에는 제휴 링크가 포함될 수 있으며 구매 시 일정 수수료를 받을 수 있습니다.",
          outputSchema: {
            oneLineValue: "string",
            targetPersona: "string",
            coreBenefits: ["string"],
            proofPoints: ["string"],
            riskClaimsToAvoid: ["string"],
            visualIdentity: { mood: "string", setting: "string", camera: "string", lighting: "string", palette: "string" },
            campaignConcept: "string",
            imagePrompt: "상업용 신규 광고 이미지 프롬프트. 원본 사진과 다른 배경·구도. 텍스트·로고 없음.",
            thumbnailHeadline: "12자 안팎의 한국어 문구",
            blogTitle: "string",
            blogHtml: "HTML string",
            shortsTitle: "string",
            shortsDescription: "string",
            hashtags: ["string"],
            masterVideoPrompt: "멀티샷 영상 공통 연출 지시",
          },
        }),
      },
    ],
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("상품 DNA 결과가 없습니다.");
  const parsed = JSON.parse(text) as ProductDNA;
  if (!parsed.imagePrompt || !parsed.blogHtml || !parsed.masterVideoPrompt) throw new Error("상품 DNA 결과 형식이 올바르지 않습니다.");
  return parsed;
}
