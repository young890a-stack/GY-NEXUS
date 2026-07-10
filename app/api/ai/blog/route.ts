import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const title = body.title?.trim();
    const description = body.description?.trim();

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "상품명이 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const prompt = `
너는 제휴마케팅과 네이버 블로그 SEO 콘텐츠를 전문적으로 작성하는 작가야.

아래 상품 정보를 바탕으로 네이버 블로그에 바로 게시할 수 있는 독창적인 글을 작성해줘.

[상품명]
${title}

[상품 설명]
${description || "상품 설명 없음"}

[작성 조건]

1. 글 맨 위에 클릭을 유도할 수 있는 SEO 제목을 1개 작성해줘.

2. 본문은 공백을 제외하고 충분히 자세하게 작성해줘.
- 권장 분량은 약 2,000자 이상
- 초보자도 이해하기 쉬운 표현 사용
- 자연스러운 후기형 문체 사용
- 실제로 사용하지 않은 경험을 사실처럼 단정하지 않기
- 상품의 특징과 활용 방법을 구체적으로 설명하기
- 장점뿐 아니라 구매 전에 확인할 점도 포함하기
- 과장된 효과나 확인되지 않은 성능을 단정하지 않기
- 동일한 키워드를 부자연스럽게 반복하지 않기

3. 다음 소제목을 포함해줘.
- 이 상품이 주목받는 이유
- 주요 특징
- 이런 상황에서 활용하기 좋습니다
- 추천 대상
- 구매 전 확인할 점
- 정리

4. 제휴마케팅 글에 어울리도록 자연스러운 행동 유도 문장을 마지막 부분에 작성해줘.
단, 무조건 구매하라는 표현이나 허위 긴급성은 사용하지 마.

5. 글 마지막에 다음 광고 고지 문구를 반드시 포함해줘.

"이 글은 제휴마케팅 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다."

6. 마지막에 상품과 관련된 해시태그 15개를 한 줄로 작성해줘.

7. 결과에는 설명이나 작업 과정 없이 완성된 블로그 글만 출력해줘.
`;

    const response = await openai.responses.create({
      model: "gpt-5.5",
      input: prompt,
    });

    const blog = response.output_text?.trim();

    if (!blog) {
      return NextResponse.json(
        {
          success: false,
          message: "AI가 블로그 내용을 생성하지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      blog,
    });
  } catch (error: unknown) {
    console.error("AI 블로그 생성 오류:", error);

    const message =
      error instanceof Error
        ? error.message
        : "AI 블로그 생성 중 알 수 없는 오류가 발생했습니다.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 500,
      }
    );
  }
}