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
너는 유튜브 쇼츠, 인스타그램 릴스, 제휴마케팅 광고 영상을 전문적으로 기획하는 콘텐츠 제작자야.

아래 상품을 바탕으로 20대부터 40대까지 관심을 가질 수 있는 15초 쇼츠 콘텐츠를 작성해줘.

[상품명]
${title}

[상품 설명]
${description || "상품 설명 없음"}

[중요 조건]

- 전체 영상 길이는 정확히 15초 기준
- 영상 안에는 글자, 로고, 이상한 문자, 자동 생성 자막이 나오지 않도록 구성
- 음성 대본은 짧고 자연스럽게 작성
- 상품 설명에 없는 기능은 만들지 않기
- 과장 광고나 허위 효과를 사용하지 않기
- 실제 상품의 형태와 기능을 임의로 바꾸지 않기
- 첫 장면은 영화처럼 강한 시각적 장면으로 시작
- 영상 프롬프트에는 자막 없음, 화면 텍스트 없음 조건을 분명히 작성
- 결과에는 작업 과정 설명 없이 완성된 콘텐츠만 출력

반드시 아래 형식으로 작성해줘.

━━━━━━━━━━━━━━━━━━
1. 쇼츠 제목 5개
━━━━━━━━━━━━━━━━━━

조회수와 궁금증을 높일 수 있는 제목을 5개 작성해줘.
과장되거나 사실과 다른 표현은 사용하지 마.

━━━━━━━━━━━━━━━━━━
2. 15초 장면 구성
━━━━━━━━━━━━━━━━━━

[0~3초: 강한 훅]
- 화면:
- 카메라:
- 효과:
- 음성:

[4~7초: 문제 또는 필요성]
- 화면:
- 카메라:
- 효과:
- 음성:

[8~11초: 상품 핵심 특징]
- 화면:
- 카메라:
- 효과:
- 음성:

[12~15초: 자연스러운 행동 유도]
- 화면:
- 카메라:
- 효과:
- 음성:

━━━━━━━━━━━━━━━━━━
3. 음성 대본만 모아서 작성
━━━━━━━━━━━━━━━━━━

15초 안에 읽을 수 있도록 한 문단으로 작성해줘.
자막 문장은 작성하지 마.

━━━━━━━━━━━━━━━━━━
4. 캡컷 AI 영상 생성용 통합 프롬프트
━━━━━━━━━━━━━━━━━━

복사해서 사용할 수 있도록 하나의 완성된 프롬프트로 작성해줘.

반드시 다음 조건을 포함해줘.

- 세로형 9:16
- 총 15초
- 영화 같은 조명과 카메라 움직임
- 현실적인 제품 광고
- 실제 상품의 디자인과 기능 유지
- 손과 물체가 자연스럽게 표현됨
- 화면 자막 없음
- 텍스트 없음
- 글자 없음
- 로고 추가 없음
- 워터마크 없음
- 의미 없는 문자 없음
- 자동 자막 없음
- 제품에 없는 포트나 부품 추가 금지
- 제품 모양 변형 금지

━━━━━━━━━━━━━━━━━━
5. 썸네일 문구 5개
━━━━━━━━━━━━━━━━━━

짧고 궁금증을 유발하는 문구를 작성해줘.

━━━━━━━━━━━━━━━━━━
6. 업로드 설명
━━━━━━━━━━━━━━━━━━

유튜브 쇼츠와 인스타그램 릴스에 사용할 수 있는 자연스러운 소개 글을 작성해줘.
마지막에는 제휴마케팅 고지 문구를 포함해줘.

광고 고지 문구:
"이 콘텐츠는 제휴마케팅 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다."

━━━━━━━━━━━━━━━━━━
7. 해시태그 15개
━━━━━━━━━━━━━━━━━━

상품과 관련된 해시태그를 한 줄로 작성해줘.
`;

    const response = await openai.responses.create({
      model: "gpt-5.5",
      input: prompt,
    });

    const shorts = response.output_text?.trim();

    if (!shorts) {
      return NextResponse.json(
        {
          success: false,
          message: "AI가 쇼츠 내용을 생성하지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      shorts,
    });
  } catch (error: unknown) {
    console.error("AI 쇼츠 생성 오류:", error);

    const message =
      error instanceof Error
        ? error.message
        : "AI 쇼츠 생성 중 알 수 없는 오류가 발생했습니다.";

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