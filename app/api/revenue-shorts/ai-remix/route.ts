import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

type KeywordSignal = {
  keyword: string;
  koreanMeaning: string;
  intent: string;
  score: number;
  evidenceCount: number;
  selected: boolean;
};

type SourceInput = {
  id: string;
  title: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
};

type CurrentCut = {
  order?: number;
  sourceId?: string;
  sourceStartSecond?: number;
  durationSeconds?: number;
  role?: string;
  priorityKeyword?: string;
  subtitleIntent?: string;
  direction?: string;
  reason?: string;
  locked?: boolean;
};

type RemixCut = {
  order: number;
  sourceId: string;
  sourceStartSecond: number;
  durationSeconds: number;
  role: string;
  priorityKeyword: string;
  subtitleIntent: string;
  direction: string;
  reason: string;
  locked: boolean;
};

const remixSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    cuts: {
      type: "array",
      minItems: 5,
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          order: { type: "integer" },
          sourceId: { type: "string" },
          sourceStartSecond: { type: "number" },
          durationSeconds: { type: "number", minimum: .7, maximum: 2.5 },
          role: { type: "string", enum: ["hook", "problem", "demo", "detail", "proof", "benefit", "cta"] },
          priorityKeyword: { type: "string" },
          subtitleIntent: { type: "string" },
          direction: { type: "string" },
          reason: { type: "string" },
          locked: { type: "boolean" },
        },
        required: [
          "order",
          "sourceId",
          "sourceStartSecond",
          "durationSeconds",
          "role",
          "priorityKeyword",
          "subtitleIntent",
          "direction",
          "reason",
          "locked",
        ],
      },
    },
  },
  required: ["summary", "cuts"],
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeSignals(value: unknown) {
  if (!Array.isArray(value)) return [] as KeywordSignal[];
  return value
    .map((item) => {
      const row = record(item);
      return {
        keyword: String(row.keyword || "").trim(),
        koreanMeaning: String(row.koreanMeaning || "").trim(),
        intent: String(row.intent || "product").trim(),
        score: clamp(Number(row.score) || 0, 0, 100),
        evidenceCount: Math.max(0, Number(row.evidenceCount) || 0),
        selected: row.selected !== false,
      };
    })
    .filter((item) => item.keyword)
    .sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount)
    .slice(0, 12);
}

function normalizeSources(value: unknown) {
  if (!Array.isArray(value)) return [] as SourceInput[];
  return value
    .map((item) => {
      const row = record(item);
      const duration = Math.max(.7, Number(row.duration) || 0);
      const trimStart = clamp(Number(row.trimStart) || 0, 0, Math.max(0, duration - .7));
      const trimEnd = clamp(Number(row.trimEnd) || duration, trimStart + .7, duration);
      return {
        id: String(row.id || "").trim(),
        title: String(row.title || "영상 소스").trim(),
        duration,
        trimStart,
        trimEnd,
      };
    })
    .filter((item) => item.id)
    .slice(0, 12);
}

function normalizeCurrentCuts(value: unknown) {
  if (!Array.isArray(value)) return [] as CurrentCut[];
  return value.map((item) => {
    const row = record(item);
    return {
      order: Number(row.order) || 0,
      sourceId: String(row.sourceId || ""),
      sourceStartSecond: Math.max(0, Number(row.sourceStartSecond) || 0),
      durationSeconds: clamp(Number(row.durationSeconds) || 1.5, .7, 2.5),
      role: String(row.role || "demo"),
      priorityKeyword: String(row.priorityKeyword || ""),
      subtitleIntent: String(row.subtitleIntent || ""),
      direction: String(row.direction || ""),
      reason: String(row.reason || ""),
      locked: Boolean(row.locked),
    };
  }).slice(0, 30);
}

function subtitleForRole(role: string, productName: string, meaning: string) {
  const focus = meaning || productName || "이 상품";
  if (role === "hook") return `${productName}, 첫 장면에서 차이가 보입니다.`;
  if (role === "problem") return `불편했던 순간, ${focus}가 필요한 이유입니다.`;
  if (role === "demo") return `실제 사용 장면으로 핵심 기능을 확인하세요.`;
  if (role === "detail") return `${focus}, 가까이 보면 디테일이 더 분명합니다.`;
  if (role === "proof") return `과장 없이 사용 흐름과 차이를 확인해보세요.`;
  if (role === "benefit") return `${productName}이 일상을 어떻게 간단하게 만드는지 보여드립니다.`;
  return `필요했던 분은 상품 링크에서 자세히 확인하세요.`;
}

function localRemix(input: {
  productName: string;
  targetDuration: number;
  mode: string;
  popularFirst: boolean;
  instruction: string;
  signals: KeywordSignal[];
  sources: SourceInput[];
  currentCuts: CurrentCut[];
}) {
  const selected = input.signals.filter((item) => item.selected).slice(0, 5);
  const rolesByMode: Record<string, string[]> = {
    "popular-first": ["hook", "problem", "demo", "detail", "proof", "benefit", "cta"],
    "conversion-first": ["hook", "benefit", "demo", "proof", "detail", "benefit", "cta"],
    "fast-cuts": ["hook", "demo", "detail", "demo", "proof", "benefit", "cta"],
    "trust-first": ["hook", "problem", "demo", "proof", "detail", "benefit", "cta"],
  };
  const roles = rolesByMode[input.mode] || rolesByMode["popular-first"];
  const locked = new Map(
    input.currentCuts
      .filter((cut) => cut.locked && cut.order && cut.sourceId)
      .map((cut) => [Number(cut.order), cut]),
  );
  const cuts: RemixCut[] = [];
  let cursor = 0;
  let index = 0;

  while (cursor < input.targetDuration - .05 && cuts.length < 30) {
    const order = cuts.length + 1;
    const lockedCut = locked.get(order);
    const source = lockedCut
      ? input.sources.find((item) => item.id === lockedCut.sourceId) || input.sources[index % input.sources.length]
      : input.sources[index % input.sources.length];
    const role = lockedCut?.role || (order === 1 ? "hook" : input.targetDuration - cursor <= 2.2 ? "cta" : roles[1 + (index % (roles.length - 2))]);
    const signal = selected[index % Math.max(1, selected.length)];
    const preferred = role === "hook" ? 1.4 : role === "cta" ? 2 : input.mode === "fast-cuts" ? 1.15 : role === "demo" ? 1.8 : 1.6;
    const durationSeconds = Number(Math.min(2.5, Math.max(.7, lockedCut?.durationSeconds || preferred), input.targetDuration - cursor).toFixed(2));
    const available = Math.max(.7, source.trimEnd - source.trimStart);
    const safeWindow = Math.max(.01, available - durationSeconds);
    const sourceStartSecond = lockedCut
      ? clamp(Number(lockedCut.sourceStartSecond) || source.trimStart, source.trimStart, Math.max(source.trimStart, source.trimEnd - .7))
      : Number((source.trimStart + ((index * 1.41) % safeWindow)).toFixed(2));

    cuts.push({
      order,
      sourceId: source.id,
      sourceStartSecond,
      durationSeconds,
      role,
      priorityKeyword: lockedCut?.priorityKeyword || signal?.keyword || "",
      subtitleIntent: lockedCut?.subtitleIntent || subtitleForRole(role, input.productName, signal?.koreanMeaning || ""),
      direction: lockedCut?.direction || (
        role === "hook"
          ? "첫 1.5초 안에 가장 강한 문제 또는 결과 장면을 보여준다."
          : role === "cta"
            ? "상품을 선명하게 다시 보여주고 짧은 구매 안내로 끝낸다."
            : "실제 사용 장면과 제품 디테일을 빠르게 교차 편집한다."
      ),
      reason: lockedCut?.reason || (
        signal
          ? `인기 키워드 ${signal.keyword} · ${signal.score}점 · 검색 근거 ${signal.evidenceCount}건 반영`
          : "상품의 문제 해결과 실제 사용 흐름을 기준으로 배치"
      ),
      locked: Boolean(lockedCut?.locked),
    });

    cursor += durationSeconds;
    index += 1;
  }

  return {
    summary: `무료 인기 우선 엔진이 ${selected.slice(0, 3).map((item) => `${item.keyword}(${item.score})`).join(", ") || "상품 사용 흐름"}를 기준으로 ${cuts.length}컷을 구성했습니다.${input.instruction ? ` 수정 지시: ${input.instruction}` : ""}`,
    cuts,
  };
}

function validateAiCuts(cuts: RemixCut[], sources: SourceInput[], currentCuts: CurrentCut[]) {
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const locked = new Map(
    currentCuts
      .filter((cut) => cut.locked && cut.order && cut.sourceId)
      .map((cut) => [Number(cut.order), cut]),
  );

  return cuts.map((cut, index) => {
    const order = index + 1;
    const lockedCut = locked.get(order);
    const requestedSourceId = lockedCut?.sourceId || cut.sourceId;
    const source = sourceMap.get(String(requestedSourceId)) || sources[index % sources.length];
    const durationSeconds = clamp(Number(lockedCut?.durationSeconds || cut.durationSeconds) || 1.5, .7, 2.5);
    const sourceStartSecond = clamp(
      Number(lockedCut?.sourceStartSecond ?? cut.sourceStartSecond) || source.trimStart,
      source.trimStart,
      Math.max(source.trimStart, source.trimEnd - .7),
    );

    return {
      ...cut,
      order,
      sourceId: source.id,
      sourceStartSecond,
      durationSeconds,
      role: String(lockedCut?.role || cut.role || "demo"),
      priorityKeyword: String(lockedCut?.priorityKeyword || cut.priorityKeyword || ""),
      subtitleIntent: String(lockedCut?.subtitleIntent || cut.subtitleIntent || ""),
      direction: String(lockedCut?.direction || cut.direction || ""),
      reason: String(lockedCut?.reason || cut.reason || ""),
      locked: Boolean(lockedCut?.locked),
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const productName = String(body.productName || "").trim();
    const productDescription = String(body.productDescription || "").trim();
    const targetDuration = clamp(Math.round(Number(body.targetDuration) || 20), 15, 30);
    const mode = ["popular-first", "conversion-first", "fast-cuts", "trust-first"].includes(String(body.mode))
      ? String(body.mode)
      : "popular-first";
    const popularFirst = body.popularFirst !== false;
    const instruction = String(body.instruction || "").trim().slice(0, 1200);
    const signals = normalizeSignals(body.keywordSignals);
    const sources = normalizeSources(body.sources);
    const currentCuts = normalizeCurrentCuts(body.currentCuts);

    if (!productName) {
      return NextResponse.json({ success: false, message: "상품명을 입력해주세요." }, { status: 400 });
    }
    if (!sources.length) {
      return NextResponse.json({ success: false, message: "AI 짜집기에 사용할 직접 촬영·허가 영상이 없습니다." }, { status: 400 });
    }

    const fallback = localRemix({
      productName,
      targetDuration,
      mode,
      popularFirst,
      instruction,
      signals,
      sources,
      currentCuts,
    });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        engine: "local",
        warning: "OPENAI_API_KEY가 없어 무료 인기 우선 엔진을 사용했습니다.",
        ...fallback,
      });
    }

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model = process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_FAST_MODEL || process.env.OPENAI_QUALITY_MODEL || "gpt-5.6-sol";
      const response = await openai.responses.create({
        model,
        reasoning: { effort: "medium" },
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: [
              "당신은 GY Labs의 한국형 쇼핑 쇼츠 전환 편집감독이다.",
              `상품명: ${productName}`,
              `검증된 상품 설명: ${productDescription || "없음"}`,
              `목표 길이: ${targetDuration}초`,
              `편집 방식: ${mode}`,
              `인기 키워드 강제 우선: ${popularFirst}`,
              `대표 수정 지시: ${instruction || "없음"}`,
              `점수순 키워드: ${JSON.stringify(signals)}`,
              `사용 허가 영상: ${JSON.stringify(sources)}`,
              `현재 편집 컷: ${JSON.stringify(currentCuts)}`,
              "selected=true인 상위 3개 키워드를 첫 3초 훅, 실제 사용, 제품 디테일 장면에 우선 반영한다.",
              "score와 evidenceCount가 높은 키워드일수록 더 앞쪽·더 중요한 장면에 배치한다.",
              "현재 컷 중 locked=true인 컷은 같은 order, sourceId, sourceStartSecond, durationSeconds, 자막 의도를 반드시 유지한다.",
              "같은 원본의 같은 시작 구간을 반복하지 말고 여러 구간을 교차 사용한다.",
              "각 컷은 0.7~2.5초이며 전체 길이는 목표 길이에 최대한 맞춘다.",
              "subtitleIntent는 자연스러운 한국어 한 문장으로 쓰고 검증되지 않은 판매량·효능·가격을 만들지 않는다.",
              "첫 장면은 결과 또는 문제, 중간은 실제 사용·디테일·증거, 마지막은 짧은 상품 CTA로 구성한다.",
            ].join("\n"),
          }],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "gy_popular_keyword_ai_remix",
            strict: true,
            schema: remixSchema,
          },
        },
        max_output_tokens: 6000,
      });

      const raw = response.output_text?.trim();
      if (!raw) throw new Error("AI 편집 결과가 비어 있습니다.");
      const parsed = JSON.parse(raw) as { summary: string; cuts: RemixCut[] };
      const cuts = validateAiCuts(parsed.cuts, sources, currentCuts);

      return NextResponse.json({
        success: true,
        engine: "ai",
        model,
        summary: parsed.summary,
        cuts,
      });
    } catch (error) {
      return NextResponse.json({
        success: true,
        engine: "local",
        warning: error instanceof Error ? error.message : "AI 편집 응답 실패",
        ...fallback,
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "AI 짜집기 수정에 실패했습니다.",
    }, { status: 500 });
  }
}
