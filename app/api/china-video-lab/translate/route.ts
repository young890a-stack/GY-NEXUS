import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Keyword = {
  simplifiedChinese: string;
  koreanMeaning: string;
  intent: "product" | "problem" | "use-case" | "review" | "viral";
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    translatedProductName: { type: "string" },
    keywords: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          simplifiedChinese: { type: "string" },
          koreanMeaning: { type: "string" },
          intent: { type: "string", enum: ["product", "problem", "use-case", "review", "viral"] },
        },
        required: ["simplifiedChinese", "koreanMeaning", "intent"],
      },
    },
  },
  required: ["translatedProductName", "keywords"],
} as const;

const fallbackDictionary: Array<{
  test: RegExp;
  translatedProductName: string;
  keywords: string[];
}> = [
  {
    test: /손\s*선풍기|휴대용\s*선풍기/i,
    translatedProductName: "手持小风扇",
    keywords: ["手持小风扇", "便携风扇", "迷你风扇", "夏季降温", "桌面风扇", "风扇测评"],
  },
  {
    test: /세탁조|세탁기.*청소|세탁.*클리너/i,
    translatedProductName: "洗衣机槽清洁剂",
    keywords: ["洗衣机槽清洁剂", "洗衣机清洁", "洗衣机除垢", "滚筒清洁", "清洁前后", "家务好物"],
  },
  {
    test: /키보드.*청소|키보드.*클리너/i,
    translatedProductName: "键盘清洁工具",
    keywords: ["键盘清洁工具", "键盘清灰", "电脑清洁", "清洁软胶", "桌面清洁", "清洁好物"],
  },
  {
    test: /보조\s*배터리/i,
    translatedProductName: "充电宝",
    keywords: ["充电宝", "便携充电宝", "快充充电宝", "移动电源", "充电测试", "数码好物"],
  },
  {
    test: /무선.*이어폰|블루투스.*이어폰/i,
    translatedProductName: "无线耳机",
    keywords: ["无线耳机", "蓝牙耳机", "降噪耳机", "耳机测评", "通勤耳机", "数码好物"],
  },
  {
    test: /태블릿|갤럭시\s*탭/i,
    translatedProductName: "平板电脑",
    keywords: ["平板电脑", "安卓平板", "学习平板", "办公平板", "平板测评", "数码好物"],
  },
  {
    test: /USB.?C.*허브|USB.*허브/i,
    translatedProductName: "USB-C扩展坞",
    keywords: ["USB-C扩展坞", "多功能扩展坞", "电脑接口扩展", "扩展坞测评", "办公好物", "数码配件"],
  },
];

function fallbackPlan(query: string) {
  const match = fallbackDictionary.find((item) => item.test.test(query));
  if (!match) return null;
  const intents: Keyword["intent"][] = ["product", "product", "problem", "use-case", "review", "viral"];
  return {
    translatedProductName: match.translatedProductName,
    keywords: match.keywords.map((simplifiedChinese, index) => ({
      simplifiedChinese,
      koreanMeaning: index === 0 ? "중국어 상품명" : "검색 확장어",
      intent: intents[index] || "product",
    })),
    source: "fallback-dictionary",
  };
}

function normalizeKeyword(item: Keyword): Keyword {
  return {
    simplifiedChinese: String(item.simplifiedChinese || "").replace(/\s+/g, " ").trim().slice(0, 40),
    koreanMeaning: String(item.koreanMeaning || "").replace(/\s+/g, " ").trim().slice(0, 80),
    intent: item.intent,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { query?: unknown };
    const query = String(body.query || "").replace(/\s+/g, " ").trim();

    if (query.length < 2 || query.length > 100) {
      return NextResponse.json(
        { success: false, message: "상품명이나 검색어를 2~100자로 입력해주세요." },
        { status: 400 },
      );
    }

    const dictionaryPlan = fallbackPlan(query);

    if (!process.env.OPENAI_API_KEY) {
      if (dictionaryPlan) {
        return NextResponse.json({ success: true, query, ...dictionaryPlan });
      }
      return NextResponse.json({
        success: false,
        query,
        translatedProductName: query,
        keywords: [],
        message: "OPENAI_API_KEY가 없어 자동 번역을 실행하지 못했습니다. 중국어 검색어를 직접 입력하면 Edge 로그인 검색은 계속 사용할 수 있습니다.",
      }, { status: 503 });
    }

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.responses.create({
        model: process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || "gpt-5.6",
        reasoning: { effort: "low" },
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: [
              "한국 상품을 도우인과 샤오홍슈에서 찾기 위한 중국어 검색어를 만든다.",
              `입력 상품명: ${query}`,
              "정확한 중국어 간체 상품명 1개와 실제 사용자가 검색할 짧은 키워드 5~8개를 만든다.",
              "상품명, 문제 해결, 사용 상황, 후기, 바이럴 표현을 고르게 포함한다.",
              "브랜드, 판매량, 효능, 인기 수치를 만들지 않는다.",
              "한국어 문자를 중국어 검색어에 섞지 않는다.",
            ].join("\n"),
          }],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "china_video_lab_keywords",
            strict: true,
            schema,
          },
        },
        max_output_tokens: 1200,
      });

      const parsed = JSON.parse(response.output_text || "{}") as {
        translatedProductName?: string;
        keywords?: Keyword[];
      };
      const translatedProductName = String(parsed.translatedProductName || "").trim().slice(0, 80);
      const keywords = Array.isArray(parsed.keywords)
        ? parsed.keywords.map(normalizeKeyword).filter((item) => item.simplifiedChinese).slice(0, 8)
        : [];
      const koreanInput = /[\p{Script=Hangul}]/u.test(query);
      const valid = translatedProductName
        && keywords.length >= 5
        && (
          !koreanInput
          || (
            !/[\p{Script=Hangul}]/u.test(translatedProductName)
            && keywords.every((item) => !/[\p{Script=Hangul}]/u.test(item.simplifiedChinese))
          )
        );

      if (!valid) throw new Error("중국어 검색어 검증 실패");

      return NextResponse.json({
        success: true,
        query,
        translatedProductName,
        keywords,
        source: "openai",
      });
    } catch (error) {
      if (dictionaryPlan) {
        return NextResponse.json({
          success: true,
          query,
          ...dictionaryPlan,
          warning: error instanceof Error ? error.message : "AI 번역 실패",
        });
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "중국어 검색어를 만들지 못했습니다.",
    }, { status: 500 });
  }
}
