import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContentType = "blog" | "shorts" | "package";

type RequestBody = {
  productId?: string;
  title?: string;
  description?: string;
  contentType?: ContentType;
};

function createPrompt(
  contentType: ContentType,
  title: string,
  description: string
) {
  const common = `
너는 대한민국의 제휴마케팅, 네이버 블로그 SEO, 구글 SEO,
유튜브 쇼츠 기획 분야에서 경험이 풍부한 콘텐츠 전문가다.

아래 상품 정보를 바탕으로 정확하고 자연스러운 한국어 콘텐츠를 작성하라.

상품명:
${title}

상품 설명:
${description || "상품 설명이 제공되지 않았습니다."}

공통 작성 기준:
- 확인되지 않은 성능이나 효과를 사실처럼 단정하지 않는다.
- 허위 후기처럼 작성하지 않는다.
- 과장 광고와 무조건적인 구매 유도를 피한다.
- 초보자도 이해할 수 있는 자연스러운 문체를 사용한다.
- 제휴마케팅 광고 고지 문구를 포함한다.
- 결과만 출력하고 불필요한 설명은 하지 않는다.
`;

  if (contentType === "blog") {
    return `${common}

다음 형식으로 블로그 콘텐츠를 작성하라.

# SEO 블로그 제목
클릭을 유도하면서 과장되지 않은 제목 1개

# 메타 설명
검색 결과에 사용할 100~150자 내외의 설명

# 블로그 본문
- 2,000자 이상
- 도입부
- 상품 특징
- 활용 상황
- 장점
- 구매 전에 확인할 사항
- 추천 대상
- 마무리
- 자연스러운 소제목 사용

# 광고 고지
"이 글에는 제휴 링크가 포함될 수 있으며, 구매 시 일정 수수료를 제공받을 수 있습니다."

# 해시태그
관련 해시태그 10개
`;
  }

  if (contentType === "shorts") {
    return `${common}

자막 없이 영상과 음성 중심으로 사용할 수 있는
15초 유튜브 쇼츠 기획안을 다음 형식으로 작성하라.

# 쇼츠 제목
짧고 관심을 끄는 제목 3개

# 썸네일 문구
짧은 문구 3개

# 15초 쇼츠 구성

## 0~3초
- 강한 첫 장면
- 시청자의 궁금증을 유발하는 음성 대사

## 4~10초
- 핵심 특징을 보여주는 장면
- 자연스러운 음성 대사

## 11~15초
- 사용 상황 또는 결론 장면
- 과장되지 않은 클릭 유도 음성 대사

# 영상 생성 프롬프트
제품의 외형을 임의로 바꾸지 않고 실제 광고 영상처럼 표현할 수 있는 한국어 프롬프트

# 설명 문구
유튜브와 인스타그램에 함께 사용할 수 있는 짧은 설명

# 해시태그
관련 해시태그 10개

# 광고 고지
제휴 링크 광고 고지 문구
`;
  }

  return `${common}

아래 항목을 하나의 완성된 패키지로 작성하라.

# 1. SEO 제목 5개

# 2. 메타 설명

# 3. 블로그 본문
- 2,000자 이상
- 도입부
- 특징
- 활용 상황
- 장점
- 구매 전 확인 사항
- 추천 대상
- 결론
- 광고 고지 포함

# 4. 15초 쇼츠 기획안
- 0~3초 훅
- 4~10초 핵심 소개
- 11~15초 클릭 유도
- 장면 설명과 음성 대사 분리
- 자막 없는 영상 기준

# 5. 쇼츠 제목 5개

# 6. 썸네일 문구 5개

# 7. 영상 생성 프롬프트

# 8. SEO 핵심 키워드 10개

# 9. 해시태그 15개

# 10. 광고 고지 문구
`;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          message: "OPENAI_API_KEY가 설정되지 않았습니다.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;

    const productId = body.productId?.trim() || null;
    const title = body.title?.trim();
    const description = body.description?.trim() || "";
    const contentType = body.contentType || "package";

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "상품명이 없습니다.",
        },
        { status: 400 }
      );
    }

    if (!["blog", "shorts", "package"].includes(contentType)) {
      return NextResponse.json(
        {
          success: false,
          message: "올바르지 않은 콘텐츠 유형입니다.",
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model: "gpt-5.5",
      input: createPrompt(contentType, title, description),
    });

    const generatedContent = response.output_text?.trim();

    if (!generatedContent) {
      return NextResponse.json(
        {
          success: false,
          message: "AI가 빈 결과를 반환했습니다.",
        },
        { status: 500 }
      );
    }

    let savedContentId: string | null = null;
    let saveWarning = "";

    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from("ai_contents")
        .insert({
          product_id: productId,
          product_title: title,
          content_type: contentType,
          title:
            contentType === "blog"
              ? `${title} 블로그`
              : contentType === "shorts"
                ? `${title} 15초 쇼츠`
                : `${title} 전체 콘텐츠 패키지`,
          content: generatedContent,
        })
        .select("id")
        .single();

      if (error) {
        saveWarning = error.message;
      } else {
        savedContentId = data.id;
      }
    } catch (error) {
      saveWarning =
        error instanceof Error
          ? error.message
          : "생성 결과를 저장하지 못했습니다.";
    }

    return NextResponse.json({
      success: true,
      content: generatedContent,
      savedContentId,
      saveWarning,
    });
  } catch (error) {
    console.error("AI 콘텐츠 생성 오류:", error);

    const message =
      error instanceof Error
        ? error.message
        : "AI 콘텐츠 생성 중 알 수 없는 오류가 발생했습니다.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}