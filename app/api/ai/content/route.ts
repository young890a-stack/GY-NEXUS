import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { title, description } = await req.json();

    const prompt = `
너는 제휴마케팅, 네이버 블로그 SEO, 유튜브 쇼츠 전문가야.

아래 상품 정보를 바탕으로 콘텐츠를 만들어줘.

상품명:
${title}

상품설명:
${description}

반드시 아래 형식으로 작성해줘.

1. SEO 블로그 제목 5개

2. 네이버 블로그 글
- 2000자 이상
- 자연스러운 후기형 문체
- 초보자도 이해하기 쉽게
- 장점, 추천 대상, 사용 상황 포함
- 과장 광고 금지
- 마지막에 광고 고지 문구 포함

3. 유튜브 쇼츠 15초 대본
- 0~3초 훅
- 4~10초 핵심 설명
- 11~15초 클릭 유도
- 자막 없이 음성 대본만 작성

4. 썸네일 문구 5개

5. 해시태그 20개
`;

    const response = await openai.responses.create({
      model: "gpt-5.5",
      input: prompt,
    });

    return NextResponse.json({
      success: true,
      content: response.output_text,
    });
  } catch (error: any) {
    console.error("AI 콘텐츠 생성 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "AI 콘텐츠 생성 실패",
      },
      { status: 500 }
    );
  }
}