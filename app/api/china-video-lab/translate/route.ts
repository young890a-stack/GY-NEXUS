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
          intent: {
            type: "string",
            enum: ["product", "problem", "use-case", "review", "viral"],
          },
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
  { test: /손\s*선풍기|휴대용\s*선풍기/i, translatedProductName: "手持小风扇", keywords: ["手持小风扇", "便携风扇", "迷你风扇", "夏季降温", "桌面风扇", "风扇测评"] },
  { test: /세탁조|세탁기.*청소|세탁.*클리너/i, translatedProductName: "洗衣机槽清洁剂", keywords: ["洗衣机槽清洁剂", "洗衣机清洁", "洗衣机除垢", "滚筒清洁", "清洁前后", "家务好物"] },
  { test: /키보드.*청소|키보드.*클리너/i, translatedProductName: "键盘清洁工具", keywords: ["键盘清洁工具", "键盘清灰", "电脑清洁", "清洁软胶", "桌面清洁", "清洁好物"] },
  { test: /보조\s*배터리/i, translatedProductName: "充电宝", keywords: ["充电宝", "便携充电宝", "快充充电宝", "移动电源", "充电测试", "数码好物"] },
  { test: /무선.*이어폰|블루투스.*이어폰/i, translatedProductName: "无线耳机", keywords: ["无线耳机", "蓝牙耳机", "降噪耳机", "耳机测评", "通勤耳机", "数码好物"] },
  { test: /태블릿|갤럭시\s*탭/i, translatedProductName: "平板电脑", keywords: ["平板电脑", "安卓平板", "学习平板", "办公平板", "平板测评", "数码好物"] },
  { test: /USB.?C.*허브|USB.*허브/i, translatedProductName: "USB-C扩展坞", keywords: ["USB-C扩展坞", "多功能扩展坞", "电脑接口扩展", "扩展坞测评", "办公好物", "数码配件"] },
  { test: /싱크대.*배수|배수망/i, translatedProductName: "水槽过滤网", keywords: ["水槽过滤网", "水槽防堵", "厨房下水口", "过滤网安装", "厨房清洁", "厨房好物"] },
  { test: /수납.*정리|정리함|수납함/i, translatedProductName: "收纳盒", keywords: ["收纳盒", "桌面收纳", "衣柜收纳", "空间整理", "收纳前后", "家居好物"] },
  { test: /휴대폰.*거치대|핸드폰.*거치대/i, translatedProductName: "手机支架", keywords: ["手机支架", "桌面手机支架", "车载手机支架", "支架测评", "追剧神器", "数码好物"] },
  { test: /가습기/i, translatedProductName: "加湿器", keywords: ["加湿器", "桌面加湿器", "静音加湿器", "卧室加湿", "加湿器测评", "家电好物"] },
  { test: /제습기/i, translatedProductName: "除湿机", keywords: ["除湿机", "小型除湿机", "衣柜除湿", "房间除湿", "除湿机测评", "家电好物"] },
  { test: /충전기|고속\s*충전/i, translatedProductName: "快充充电器", keywords: ["快充充电器", "多口充电器", "手机快充", "充电器测评", "桌面充电", "数码配件"] },
  { test: /케이블|충전선/i, translatedProductName: "充电线", keywords: ["充电线", "快充数据线", "耐用充电线", "数据线测评", "桌面整理", "数码配件"] },
  { test: /무선\s*청소기|진공\s*청소기/i, translatedProductName: "无线吸尘器", keywords: ["无线吸尘器", "家用吸尘器", "吸力测试", "清洁前后", "吸尘器测评", "清洁好物"] },
  { test: /로봇\s*청소기/i, translatedProductName: "扫地机器人", keywords: ["扫地机器人", "智能清扫", "扫拖一体", "清洁测试", "机器人测评", "智能家居"] },
  { test: /에어프라이어/i, translatedProductName: "空气炸锅", keywords: ["空气炸锅", "空气炸锅食谱", "厨房小家电", "使用测评", "懒人料理", "厨房好物"] },
  { test: /드라이기|헤어\s*드라이어/i, translatedProductName: "吹风机", keywords: ["吹风机", "高速吹风机", "护发吹风机", "吹风机测评", "快速干发", "个护好物"] },
];

function isChineseInput(value: string) {
  const chinese = value.match(/[\p{Script=Han}]/gu)?.length || 0;
  const korean = value.match(/[\p{Script=Hangul}]/gu)?.length || 0;
  return chinese > 0 && korean === 0;
}

function directChinesePlan(query: string) {
  const suffixes = [
    ["", "중국어 상품명", "product"],
    ["测评", "사용 후기·측정", "review"],
    ["使用", "사용 방법", "use-case"],
    ["推荐", "추천형 검색", "viral"],
    ["对比", "비교형 검색", "review"],
    ["好物", "인기 생활용품 표현", "viral"],
  ] as const;

  return {
    translatedProductName: query,
    keywords: suffixes.map(([suffix, koreanMeaning, intent]) => ({
      simplifiedChinese: `${query}${suffix}`.slice(0, 40),
      koreanMeaning,
      intent,
    })),
    source: "direct-chinese",
  };
}

function fallbackPlan(query: string) {
  const match = fallbackDictionary.find((item) => item.test.test(query));
  if (!match) return null;

  const intents: Keyword["intent"][] = [
    "product",
    "product",
    "problem",
    "use-case",
    "review",
    "viral",
  ];

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
    simplifiedChinese: String(item.simplifiedChinese || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40),
    koreanMeaning: String(item.koreanMeaning || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80),
    intent: item.intent,
  };
}

async function generatePlan(openai: OpenAI, model: string, query: string) {
  const response = await openai.responses.create({
    model,
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
        name: "china_video_lab_keywords_v32",
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
  const translatedProductName = String(
    parsed.translatedProductName || "",
  ).trim().slice(0, 80);
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords
      .map(normalizeKeyword)
      .filter((item) => item.simplifiedChinese)
      .slice(0, 8)
    : [];

  const valid = translatedProductName
    && keywords.length >= 5
    && !/[\p{Script=Hangul}]/u.test(translatedProductName)
    && keywords.every(
      (item) => !/[\p{Script=Hangul}]/u.test(item.simplifiedChinese),
    );

  if (!valid) throw new Error("중국어 검색어 검증 실패");

  return { translatedProductName, keywords };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { query?: unknown };
    const query = String(body.query || "").replace(/\s+/g, " ").trim();

    if (query.length < 2 || query.length > 100) {
      return NextResponse.json({
        success: false,
        message: "상품명이나 검색어를 2~100자로 입력해주세요.",
      }, { status: 400 });
    }

    if (isChineseInput(query)) {
      return NextResponse.json({
        success: true,
        query,
        ...directChinesePlan(query),
      });
    }

    const dictionaryPlan = fallbackPlan(query);

    if (!process.env.OPENAI_API_KEY) {
      if (dictionaryPlan) {
        return NextResponse.json({
          success: true,
          query,
          ...dictionaryPlan,
          warning: "AI 키를 사용하지 않고 내장 상품 사전으로 번역했습니다.",
        });
      }

      return NextResponse.json({
        success: true,
        query,
        translatedProductName: query,
        keywords: [],
        source: "passthrough",
        warning: "OPENAI_API_KEY가 없어 자동 번역을 건너뛰었습니다. 중국어 검색어를 직접 입력하면 가장 정확합니다.",
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const configuredModel = String(
      process.env.OPENAI_TRANSLATION_MODEL
      || process.env.OPENAI_FAST_MODEL
      || "",
    ).trim();
    const modelCandidates = Array.from(
      new Set([configuredModel, "gpt-5-mini"].filter(Boolean)),
    );

    let lastError: unknown = null;

    for (const model of modelCandidates) {
      try {
        const plan = await generatePlan(openai, model, query);
        return NextResponse.json({
          success: true,
          query,
          ...plan,
          source: "openai",
          model,
        });
      } catch (error) {
        lastError = error;
      }
    }

    if (dictionaryPlan) {
      return NextResponse.json({
        success: true,
        query,
        ...dictionaryPlan,
        warning: lastError instanceof Error
          ? `AI 번역 대신 내장 상품 사전을 사용했습니다: ${lastError.message}`
          : "AI 번역 대신 내장 상품 사전을 사용했습니다.",
      });
    }

    return NextResponse.json({
      success: true,
      query,
      translatedProductName: query,
      keywords: [],
      source: "passthrough",
      warning: lastError instanceof Error
        ? `AI 번역이 응답하지 않아 원문 검색어를 사용합니다: ${lastError.message}`
        : "AI 번역이 응답하지 않아 원문 검색어를 사용합니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error
        ? error.message
        : "중국어 검색어를 만들지 못했습니다.",
    }, { status: 500 });
  }
}
