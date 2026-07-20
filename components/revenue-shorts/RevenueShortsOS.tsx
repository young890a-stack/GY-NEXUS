"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import styles from "./RevenueShortsOS.module.css";

type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Platform = "douyin" | "xiaohongshu" | "owned" | "other";
type RightsStatus = "owned" | "seller-provided" | "affiliate-provided" | "permission-confirmed" | "unverified";
type SourceKind = "local-video" | "research-link";

type LocalSource = {
  id: string;
  kind: SourceKind;
  platform: Platform;
  title: string;
  url: string;
  previewUrl: string;
  file?: File;
  duration: number;
  trimStart: number;
  trimEnd: number;
  rightsStatus: RightsStatus;
  useInFinal: boolean;
  thumbnailUrl: string;
  needsReconnect?: boolean;
};

type ScriptCue = {
  id: string;
  start: number;
  end: number;
  role: string;
  text: string;
};

type SearchResult = {
  id: string;
  platform: "douyin" | "xiaohongshu";
  title: string;
  url: string;
  thumbnailUrl?: string;
  popularityLabel?: string;
  sourceMode?: string;
  nativeRank?: number;
  hashtags?: string[];
  engagement?: {
    likes?: number | null;
    comments?: number | null;
    saves?: number | null;
  };
};

type KeywordSignal = {
  keyword: string;
  koreanMeaning: string;
  intent: string;
  score: number;
  evidenceCount: number;
  selected: boolean;
  source: "translation" | "search-evidence" | "manual";
};

type EditCut = {
  id: string;
  order: number;
  startSecond: number;
  durationSeconds: number;
  sourceId: string;
  sourceStartSecond: number;
  role: string;
  priorityKeyword: string;
  subtitleIntent: string;
  direction: string;
  reason: string;
  locked: boolean;
};

type RemixMode = "popular-first" | "conversion-first" | "fast-cuts" | "trust-first";

type Health = {
  success: boolean;
  version?: string;
  services?: {
    supabase?: { configured: boolean; message: string };
    worker?: { configured: boolean; reachable: boolean; message: string };
    openai?: { configured: boolean; optional: boolean; message: string };
  };
};

type CommercePackage = {
  productCode: string;
  title: string;
  hookOptions: string[];
  voiceover: string;
  description: string;
  hashtags: string[];
  disclosure: string;
  cta: string;
  thumbnailOptions: Array<{ headline: string; accent: string; layout: string }>;
  verifiedClaims: string[];
  cautions: string[];
  subtitleCues: Array<{ index: number; startSecond: number; endSecond: number; text: string }>;
  platformVersions: {
    youtube: { title: string; description: string; script: string; hashtags: string[] };
    instagram: { caption: string; script: string; hashtags: string[] };
  };
};

type PersistedState = {
  projectName: string;
  productName: string;
  productDescription: string;
  affiliateUrl: string;
  chineseKeyword: string;
  targetDuration: number;
  aspectRatio: "9:16" | "16:9";
  template: string;
  currentStep: StepId;
  sources: Array<Omit<LocalSource, "file" | "previewUrl">>;
  cues: ScriptCue[];
  subtitleStyle: "bold-pop" | "minimal";
  subtitleCleanupMode: "safe-bottom-crop" | "keep-licensed";
  playbackSpeed: 1 | 1.2 | 1.4;
  thumbnailHeadline: string;
  thumbnailAccent: string;
  title: string;
  description: string;
  hashtags: string;
  musicVolume: number;
  keywordSignals: KeywordSignal[];
  editCuts: EditCut[];
  remixMode: RemixMode;
  popularFirst: boolean;
  remixInstruction: string;
};

const STORAGE_KEY = "gy-revenue-shorts-os-v1";
const APP_SOURCE = "GY_NEXUS";
const steps: Array<{ id: StepId; number: string; title: string; subtitle: string }> = [
  { id: 1, number: "01", title: "상품", subtitle: "상품·목표·제휴 링크" },
  { id: 2, number: "02", title: "소스", subtitle: "검색·URL·영상 업로드" },
  { id: 3, number: "03", title: "편집", subtitle: "컷·순서·길이·9:16" },
  { id: 4, number: "04", title: "대본·음성", subtitle: "한국형 대본·TTS" },
  { id: 5, number: "05", title: "자막·음악", subtitle: "SRT·중국어 자막 정리" },
  { id: 6, number: "06", title: "썸네일", subtitle: "프레임·문구·PNG" },
  { id: 7, number: "07", title: "수익화·출력", subtitle: "제목·링크·최종 MP4" },
];

const dictionary: Array<{ test: RegExp; name: string; keywords: string[] }> = [
  { test: /손\s*선풍기|휴대용\s*선풍기/i, name: "手持小风扇", keywords: ["便携风扇", "迷你风扇", "夏季降温", "风扇测评"] },
  { test: /세탁조|세탁기.*청소|세탁.*클리너/i, name: "洗衣机槽清洁剂", keywords: ["洗衣机清洁", "洗衣机除垢", "清洁前后", "家务好物"] },
  { test: /키보드.*청소|키보드.*클리너/i, name: "键盘清洁工具", keywords: ["键盘清灰", "电脑清洁", "桌面清洁", "清洁好物"] },
  { test: /보조\s*배터리/i, name: "充电宝", keywords: ["便携充电宝", "快充充电宝", "移动电源", "充电测试"] },
  { test: /무선.*이어폰|블루투스.*이어폰/i, name: "无线耳机", keywords: ["蓝牙耳机", "降噪耳机", "耳机测评", "通勤耳机"] },
  { test: /태블릿|갤럭시\s*탭/i, name: "平板电脑", keywords: ["安卓平板", "学习平板", "办公平板", "平板测评"] },
  { test: /USB.?C.*허브|USB.*허브/i, name: "USB-C扩展坞", keywords: ["多功能扩展坞", "电脑接口扩展", "扩展坞测评", "数码配件"] },
  { test: /가습기/i, name: "加湿器", keywords: ["桌面加湿器", "静音加湿器", "卧室加湿", "加湿器测评"] },
  { test: /제습기/i, name: "除湿机", keywords: ["小型除湿机", "衣柜除湿", "房间除湿", "除湿机测评"] },
  { test: /청소기/i, name: "家用吸尘器", keywords: ["无线吸尘器", "吸力测试", "清洁前后", "清洁好物"] },
  { test: /충전기|고속\s*충전/i, name: "快充充电器", keywords: ["多口充电器", "手机快充", "充电器测评", "数码配件"] },
  { test: /거치대/i, name: "手机支架", keywords: ["桌面手机支架", "车载手机支架", "支架测评", "数码好物"] },
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function localTranslate(value: string) {
  const query = value.trim();
  if (/\p{Script=Han}/u.test(query) && !/\p{Script=Hangul}/u.test(query)) {
    return { name: query, keywords: [`${query}测评`, `${query}使用`, `${query}推荐`, `${query}对比`, `${query}好物`], source: "direct" };
  }
  const found = dictionary.find((item) => item.test.test(query));
  if (found) return { ...found, source: "dictionary" };
  return { name: "生活好物", keywords: ["生活好物", "实用好物", "使用测评", "好物推荐", "前后对比"], source: "generic" };
}

function formatClock(seconds: number, srt = false) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${srt ? "," : "."}${String(millis).padStart(3, "0")}`;
}

function cuesToSrt(cues: ScriptCue[]) {
  return cues.map((cue, index) => `${index + 1}\n${formatClock(cue.start, true)} --> ${formatClock(cue.end, true)}\n${cue.text.trim()}\n`).join("\n");
}

function downloadBlob(name: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(value: string) {
  return value.trim().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 50) || "gy-shorts";
}

function generateLocalScript(productName: string, productDescription: string, duration: number) {
  const name = productName.trim() || "이 상품";
  const detail = productDescription.trim() || "번거로운 문제를 간단하게 해결해주는 실용적인 제품";
  const weights = duration <= 15 ? [2, 3, 3, 4, 3] : duration <= 20 ? [3, 4, 4, 5, 4] : [3, 5, 5, 6, 6];
  const lines = [
    { role: "훅", text: `이거 모르고 지나가면 ${name}, 제대로 못 쓰는 겁니다.` },
    { role: "문제", text: `매번 불편했던 이유, 사실 도구 하나가 없어서였어요.` },
    { role: "해결", text: `${name}은 ${detail.replace(/[.!?]+$/g, "")}에 집중한 제품입니다.` },
    { role: "증거", text: `사용 장면을 보면 무엇이 달라지는지 바로 확인할 수 있어요.` },
    { role: "CTA", text: `필요했던 분은 설명란의 링크에서 자세히 확인해보세요.` },
  ];
  let cursor = 0;
  return lines.map((line, index) => {
    const allocated = weights[index] || 3;
    const start = cursor;
    cursor = index === lines.length - 1 ? duration : Math.min(duration, cursor + allocated);
    return { id: uid("cue"), start, end: cursor, role: line.role, text: line.text };
  });
}

function buildCommercePackage(args: {
  productName: string;
  affiliateUrl: string;
  cues: ScriptCue[];
  title: string;
  description: string;
  hashtags: string;
  thumbnailHeadline: string;
}): CommercePackage {
  const hashtags = args.hashtags.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean).map((item) => item.startsWith("#") ? item : `#${item}`).slice(0, 15);
  const voiceover = args.cues.map((cue) => cue.text.trim()).filter(Boolean).join(" ");
  const disclosure = "이 콘텐츠는 제휴 활동의 일환으로 일정액의 수수료를 제공받을 수 있습니다.";
  const description = [args.description.trim(), disclosure, args.affiliateUrl ? `상품 확인: ${args.affiliateUrl}` : ""].filter(Boolean).join("\n\n");
  return {
    productCode: `GY-${Date.now().toString(36).toUpperCase()}`,
    title: args.title,
    hookOptions: [args.cues[0]?.text || `${args.productName}, 이 장면부터 보세요.`],
    voiceover,
    description,
    hashtags,
    disclosure,
    cta: args.affiliateUrl ? "설명란 링크에서 상품을 확인하세요." : "상품 정보를 확인하세요.",
    thumbnailOptions: [{ headline: args.thumbnailHeadline, accent: "효과를 한눈에", layout: "benefit-arrow" }],
    verifiedClaims: ["사용자가 입력한 상품 설명과 실제 영상 장면만 사용"],
    cautions: ["효능·판매량·가격을 확인 없이 단정하지 않기", "타인 영상 원본을 무단으로 최종 합성하지 않기"],
    subtitleCues: args.cues.map((cue, index) => ({ index: index + 1, startSecond: cue.start, endSecond: cue.end, text: cue.text })),
    platformVersions: {
      youtube: { title: args.title, description, script: voiceover, hashtags },
      instagram: { caption: description, script: voiceover, hashtags },
    },
  };
}

async function getVideoDuration(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error(`${file.name}의 영상 정보를 읽지 못했습니다.`));
    });
    return Number.isFinite(video.duration) ? Number(video.duration.toFixed(2)) : 0;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function frameFileFromVideo(file: File, atSecond = .5) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("영상 대표 프레임을 읽지 못했습니다."));
    });
    video.currentTime = Math.min(Math.max(0, atSecond), Math.max(0, video.duration - .05));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("영상 대표 프레임 이동에 실패했습니다."));
    });
    const canvas = document.createElement("canvas");
    const maxWidth = 900;
    const scale = Math.min(1, maxWidth / Math.max(1, video.videoWidth));
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("브라우저 캔버스를 사용할 수 없습니다.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .9));
    if (!blob) throw new Error("대표 이미지를 만들지 못했습니다.");
    return new File([blob], "revenue-shorts-reference.jpg", { type: "image/jpeg" });
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

function sourceToPersisted(source: LocalSource): Omit<LocalSource, "file" | "previewUrl"> {
  const { file: _file, previewUrl: _previewUrl, ...rest } = source;
  return rest;
}

function compactText(value: string) {
  return value.toLowerCase().replace(/[\s\-_/()[\]{}.,!?'"·:;]+/g, "");
}

function resultPopularityScore(result: SearchResult) {
  const likes = Math.max(0, Number(result.engagement?.likes) || 0);
  const saves = Math.max(0, Number(result.engagement?.saves) || 0);
  const comments = Math.max(0, Number(result.engagement?.comments) || 0);
  const engagement = likes + saves * 2 + comments * 1.5;
  const engagementScore = engagement > 0 ? Math.min(55, Math.log10(engagement + 1) * 12) : 0;
  const rank = Math.max(1, Number(result.nativeRank) || 30);
  const rankScore = Math.max(0, 32 - rank * 2);
  const labelNumber = Number(String(result.popularityLabel || "").replace(/[^\d]/g, "")) || 0;
  const labelScore = labelNumber > 0 ? Math.min(18, Math.log10(labelNumber + 1) * 4) : 0;
  return Math.round(Math.min(100, 18 + engagementScore + rankScore + labelScore));
}

function seedKeywordSignals(
  items: Array<{ keyword: string; koreanMeaning?: string; intent?: string }>,
  productName: string,
) {
  return Array.from(new Map(items.map((item) => [item.keyword.trim(), item])).values())
    .filter((item) => item.keyword.trim())
    .slice(0, 12)
    .map((item, index): KeywordSignal => ({
      keyword: item.keyword.trim(),
      koreanMeaning: item.koreanMeaning?.trim() || (index === 0 ? productName.trim() || "대표 상품명" : `인기 확장 검색어 ${index}`),
      intent: item.intent?.trim() || (index === 0 ? "product" : index % 3 === 1 ? "review" : index % 3 === 2 ? "problem" : "use-case"),
      score: Math.max(50, 98 - index * 6),
      evidenceCount: 0,
      selected: index < 4,
      source: "translation",
    }));
}

function scoreKeywordSignals(
  keywords: string[],
  results: SearchResult[],
  existing: KeywordSignal[],
  productName: string,
) {
  const existingMap = new Map(existing.map((item) => [item.keyword, item]));
  return Array.from(new Set(keywords.map((item) => item.trim()).filter(Boolean)))
    .slice(0, 12)
    .map((keyword, index): KeywordSignal => {
      const normalizedKeyword = compactText(keyword);
      let evidenceCount = 0;
      let evidenceScore = 0;

      for (const result of results) {
        const haystack = compactText([result.title, ...(result.hashtags || [])].join(" "));
        if (normalizedKeyword && haystack.includes(normalizedKeyword)) {
          evidenceCount += 1;
          evidenceScore += 8;
        }
        const popularity = resultPopularityScore(result);
        if (normalizedKeyword && haystack.includes(normalizedKeyword)) {
          evidenceScore += Math.min(18, popularity * .18);
        }
      }

      const previous = existingMap.get(keyword);
      const translationBase = Math.max(45, 96 - index * 6);
      const score = Math.round(Math.min(100, translationBase + Math.min(28, evidenceScore)));
      return {
        keyword,
        koreanMeaning: previous?.koreanMeaning || (index === 0 ? productName.trim() || "대표 상품명" : `인기 확장 검색어 ${index}`),
        intent: previous?.intent || (index === 0 ? "product" : index % 3 === 1 ? "review" : index % 3 === 2 ? "problem" : "use-case"),
        score,
        evidenceCount,
        selected: previous?.selected ?? index < 4,
        source: evidenceCount > 0 ? "search-evidence" : previous?.source || "translation",
      };
    })
    .sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount);
}

function retimeCuts(cuts: EditCut[]) {
  let cursor = 0;
  return cuts.map((cut, index) => {
    const durationSeconds = Number(clamp(Number(cut.durationSeconds) || 1.5, .7, 2.5).toFixed(2));
    const next = {
      ...cut,
      order: index + 1,
      startSecond: Number(cursor.toFixed(2)),
      durationSeconds,
    };
    cursor += durationSeconds;
    return next;
  });
}

function fitCutsToDuration(cuts: EditCut[], targetDuration: number) {
  if (!cuts.length) return [];
  const next = cuts.map((cut) => ({ ...cut, durationSeconds: clamp(cut.durationSeconds, .7, 2.5) }));
  let total = next.reduce((sum, cut) => sum + cut.durationSeconds, 0);
  let guard = 0;

  while (total > targetDuration + .01 && guard < 300) {
    const adjustable = [...next].reverse().find((cut) => !cut.locked && cut.durationSeconds > .7);
    if (!adjustable) break;
    const reduceBy = Math.min(.1, adjustable.durationSeconds - .7, total - targetDuration);
    adjustable.durationSeconds = Number((adjustable.durationSeconds - reduceBy).toFixed(2));
    total -= reduceBy;
    guard += 1;
  }

  while (total < targetDuration - .01 && guard < 600) {
    const adjustable = next.find((cut) => !cut.locked && cut.durationSeconds < 2.5);
    if (!adjustable) break;
    const addBy = Math.min(.1, 2.5 - adjustable.durationSeconds, targetDuration - total);
    adjustable.durationSeconds = Number((adjustable.durationSeconds + addBy).toFixed(2));
    total += addBy;
    guard += 1;
  }

  return retimeCuts(next);
}

function roleSubtitle(role: string, productName: string, keyword: KeywordSignal | undefined) {
  const focus = keyword?.koreanMeaning || productName || "이 상품";
  if (role === "hook") return `${productName}, 첫 장면에서 차이가 보입니다.`;
  if (role === "problem") return `불편했던 순간, ${focus}가 필요한 이유입니다.`;
  if (role === "demo") return `실제 사용 장면으로 핵심 기능을 확인하세요.`;
  if (role === "detail") return `${focus}, 디테일은 가까이 보면 더 분명합니다.`;
  if (role === "proof") return `과장 없이 사용 전후 흐름을 비교해보세요.`;
  if (role === "benefit") return `${productName}이 일상을 어떻게 간단하게 만드는지 보여드립니다.`;
  return `필요했던 분은 상품 링크에서 자세히 확인하세요.`;
}

function buildLocalEditCuts(
  sources: LocalSource[],
  targetDuration: number,
  signals: KeywordSignal[],
  productName: string,
) {
  const usable = sources.filter((item) => item.kind === "local-video" && item.useInFinal);
  if (!usable.length) return [] as EditCut[];
  const selected = signals.filter((item) => item.selected).sort((a, b) => b.score - a.score).slice(0, 5);
  const roles = ["hook", "problem", "demo", "detail", "proof", "benefit", "cta"];
  const cuts: EditCut[] = [];
  let timeline = 0;
  let index = 0;

  while (timeline < targetDuration - .05 && cuts.length < 30) {
    const role = cuts.length === 0 ? "hook" : targetDuration - timeline <= 2.2 ? "cta" : roles[1 + (index % (roles.length - 2))];
    const source = usable[index % usable.length];
    const priority = selected[index % Math.max(1, selected.length)];
    const preferred = role === "hook" ? 1.4 : role === "cta" ? 2 : role === "demo" ? 1.8 : 1.6;
    const durationSeconds = Number(Math.min(2.5, Math.max(.7, preferred), targetDuration - timeline).toFixed(2));
    const available = Math.max(.7, source.trimEnd - source.trimStart);
    const safeWindow = Math.max(.01, available - durationSeconds);
    const sourceStartSecond = Number((source.trimStart + ((index * 1.37) % safeWindow)).toFixed(2));

    cuts.push({
      id: uid("cut"),
      order: cuts.length + 1,
      startSecond: Number(timeline.toFixed(2)),
      durationSeconds,
      sourceId: source.id,
      sourceStartSecond,
      role,
      priorityKeyword: priority?.keyword || "",
      subtitleIntent: roleSubtitle(role, productName, priority),
      direction: role === "hook"
        ? "첫 1.5초 안에 결과 또는 가장 강한 문제 장면을 보여준다."
        : role === "cta"
          ? "상품을 한 번 더 선명하게 보여주고 과장 없는 구매 안내로 끝낸다."
          : "인기 키워드의 검색 의도와 맞는 실제 사용 장면을 빠르게 연결한다.",
      reason: priority
        ? `인기 키워드 ${priority.keyword} · 우선점수 ${priority.score}점을 반영`
        : "상품 사용 흐름에 맞춘 무료 로컬 편집",
      locked: false,
    });

    timeline += durationSeconds;
    index += 1;
  }

  return fitCutsToDuration(cuts, targetDuration);
}

function cutsToCues(cuts: EditCut[]) {
  return retimeCuts(cuts).map((cut) => ({
    id: uid("cue"),
    start: cut.startSecond,
    end: Number((cut.startSecond + cut.durationSeconds).toFixed(2)),
    role: cut.role,
    text: cut.subtitleIntent,
  }));
}

export default function RevenueShortsOS() {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [projectName, setProjectName] = useState("새 수익 쇼츠 프로젝트");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [chineseKeyword, setChineseKeyword] = useState("");
  const [chineseKeywords, setChineseKeywords] = useState<string[]>([]);
  const [targetDuration, setTargetDuration] = useState(20);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [template, setTemplate] = useState("problem-solution");
  const [sources, setSources] = useState<LocalSource[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [keywordSignals, setKeywordSignals] = useState<KeywordSignal[]>([]);
  const [editCuts, setEditCuts] = useState<EditCut[]>([]);
  const [remixMode, setRemixMode] = useState<RemixMode>("popular-first");
  const [popularFirst, setPopularFirst] = useState(true);
  const [remixInstruction, setRemixInstruction] = useState("첫 3초를 더 강하게 만들고, 실제 사용 장면과 상품 디테일을 우선해줘.");
  const [mixSummary, setMixSummary] = useState("");
  const [cues, setCues] = useState<ScriptCue[]>([]);
  const [subtitleStyle, setSubtitleStyle] = useState<"bold-pop" | "minimal">("bold-pop");
  const [subtitleCleanupMode, setSubtitleCleanupMode] = useState<"safe-bottom-crop" | "keep-licensed">("safe-bottom-crop");
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.2 | 1.4>(1);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicVolume, setMusicVolume] = useState(.1);
  const [thumbnailHeadline, setThumbnailHeadline] = useState("이 차이, 직접 보세요");
  const [thumbnailAccent, setThumbnailAccent] = useState("3초 만에 이해");
  const [thumbnailReady, setThumbnailReady] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("쇼핑꿀템 생활꿀템 제품리뷰");
  const [health, setHealth] = useState<Health | null>(null);
  const [status, setStatus] = useState("작업실 준비 완료");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [serverProjectId, setServerProjectId] = useState("");
  const [renderStatus, setRenderStatus] = useState("");
  const [finalVideoUrl, setFinalVideoUrl] = useState("");
  const [showcasePublished, setShowcasePublished] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const finalSources = useMemo(() => sources.filter((item) => item.kind === "local-video" && item.useInFinal), [sources]);
  const totalTrimmedDuration = useMemo(() => finalSources.reduce((sum, item) => sum + Math.max(.1, item.trimEnd - item.trimStart), 0), [finalSources]);
  const rankedKeywordSignals = useMemo(() => [...keywordSignals].sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount), [keywordSignals]);
  const selectedKeywordSignals = useMemo(() => rankedKeywordSignals.filter((item) => item.selected).slice(0, 5), [rankedKeywordSignals]);
  const rankedSearchResults = useMemo(() => [...searchResults].sort((a, b) => resultPopularityScore(b) - resultPopularityScore(a)), [searchResults]);
  const editTimelineDuration = useMemo(() => editCuts.reduce((sum, cut) => sum + cut.durationSeconds, 0), [editCuts]);
  const commercePackage = useMemo(() => buildCommercePackage({ productName, affiliateUrl, cues, title, description, hashtags, thumbnailHeadline }), [productName, affiliateUrl, cues, title, description, hashtags, thumbnailHeadline]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PersistedState>;
        if (saved.projectName) setProjectName(saved.projectName);
        if (saved.productName) setProductName(saved.productName);
        if (saved.productDescription) setProductDescription(saved.productDescription);
        if (saved.affiliateUrl) setAffiliateUrl(saved.affiliateUrl);
        if (saved.chineseKeyword) setChineseKeyword(saved.chineseKeyword);
        if (saved.targetDuration) setTargetDuration(saved.targetDuration);
        if (saved.aspectRatio) setAspectRatio(saved.aspectRatio);
        if (saved.template) setTemplate(saved.template);
        if (saved.currentStep) setCurrentStep(saved.currentStep);
        if (saved.cues) setCues(saved.cues);
        if (saved.subtitleStyle) setSubtitleStyle(saved.subtitleStyle);
        if (saved.subtitleCleanupMode) setSubtitleCleanupMode(saved.subtitleCleanupMode);
        if (saved.playbackSpeed) setPlaybackSpeed(saved.playbackSpeed);
        if (saved.thumbnailHeadline) setThumbnailHeadline(saved.thumbnailHeadline);
        if (saved.thumbnailAccent) setThumbnailAccent(saved.thumbnailAccent);
        if (saved.title) setTitle(saved.title);
        if (saved.description) setDescription(saved.description);
        if (saved.hashtags) setHashtags(saved.hashtags);
        if (typeof saved.musicVolume === "number") setMusicVolume(saved.musicVolume);
        if (Array.isArray(saved.keywordSignals)) setKeywordSignals(saved.keywordSignals);
        if (Array.isArray(saved.editCuts)) setEditCuts(saved.editCuts);
        if (saved.remixMode) setRemixMode(saved.remixMode);
        if (typeof saved.popularFirst === "boolean") setPopularFirst(saved.popularFirst);
        if (saved.remixInstruction) setRemixInstruction(saved.remixInstruction);
        if (Array.isArray(saved.sources)) {
          setSources(saved.sources.map((item) => ({ ...item, previewUrl: "", needsReconnect: item.kind === "local-video" })));
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedState = {
      projectName,
      productName,
      productDescription,
      affiliateUrl,
      chineseKeyword,
      targetDuration,
      aspectRatio,
      template,
      currentStep,
      sources: sources.map(sourceToPersisted),
      cues,
      subtitleStyle,
      subtitleCleanupMode,
      playbackSpeed,
      thumbnailHeadline,
      thumbnailAccent,
      title,
      description,
      hashtags,
      musicVolume,
      keywordSignals,
      editCuts,
      remixMode,
      popularFirst,
      remixInstruction,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, projectName, productName, productDescription, affiliateUrl, chineseKeyword, targetDuration, aspectRatio, template, currentStep, sources, cues, subtitleStyle, subtitleCleanupMode, playbackSpeed, thumbnailHeadline, thumbnailAccent, title, description, hashtags, musicVolume, keywordSignals, editCuts, remixMode, popularFirst, remixInstruction]);

  useEffect(() => {
    void fetch("/api/revenue-shorts/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    if (!chineseKeywords.length) return;
    setKeywordSignals((current) => scoreKeywordSignals(chineseKeywords, searchResults, current, productName));
  }, [chineseKeywords, searchResults, productName]);

  useEffect(() => {
    function onConnectorMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || data.source !== "GY_CHINA_CONNECTOR" || data.type !== "GY_CHINA_CONNECTOR_RESULTS") return;
      const results = Array.isArray(data.results) ? data.results : [];
      const normalized = results.map((item, index) => {
        const row = item as Record<string, unknown>;
        return {
          id: String(row.id || uid(`edge-${index}`)),
          platform: row.platform === "xiaohongshu" ? "xiaohongshu" as const : "douyin" as const,
          title: String(row.title || "중국 계정 검색 결과"),
          url: String(row.url || ""),
          thumbnailUrl: String(row.thumbnailUrl || ""),
          popularityLabel: String(row.popularityLabel || "Edge 로그인 검색"),
          sourceMode: "browser-account",
          nativeRank: Number(row.nativeRank) || index + 1,
          hashtags: Array.isArray(row.hashtags) ? row.hashtags.map(String) : [],
          engagement: row.engagement && typeof row.engagement === "object"
            ? row.engagement as SearchResult["engagement"]
            : undefined,
        };
      }).filter((item) => item.url.startsWith("https://"));
      if (normalized.length) {
        setSearchResults((current) => Array.from(new Map([...normalized, ...current].map((item) => [item.url, item])).values()));
        setStatus(`Edge 로그인 검색 결과 ${normalized.length}개를 받았습니다.`);
      }
    }
    window.addEventListener("message", onConnectorMessage);
    window.postMessage({ source: APP_SOURCE, type: "GY_CHINA_CONNECTOR_PING" }, window.location.origin);
    return () => window.removeEventListener("message", onConnectorMessage);
  }, []);

  useEffect(() => {
    if (!productName.trim()) return;
    if (!cues.length) setCues(generateLocalScript(productName, productDescription, targetDuration));
    if (!title.trim()) setTitle(`${productName} 써보면 바로 느끼는 차이`);
    if (!description.trim()) setDescription(`${productName}의 핵심 사용 장면과 장점을 20초 안에 확인해보세요.`);
    if (thumbnailHeadline === "이 차이, 직접 보세요") setThumbnailHeadline(`${productName}, 이 차이 보세요`);
    // Initial product-derived defaults only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productName]);

  function resetProject() {
    for (const source of sources) if (source.previewUrl) URL.revokeObjectURL(source.previewUrl);
    window.localStorage.removeItem(STORAGE_KEY);
    setCurrentStep(1);
    setProjectName("새 수익 쇼츠 프로젝트");
    setProductName("");
    setProductDescription("");
    setAffiliateUrl("");
    setChineseKeyword("");
    setChineseKeywords([]);
    setKeywordSignals([]);
    setEditCuts([]);
    setMixSummary("");
    setSources([]);
    setSearchResults([]);
    setCues([]);
    setVoiceFile(null);
    setMusicFile(null);
    setThumbnailReady(false);
    setTitle("");
    setDescription("");
    setServerProjectId("");
    setFinalVideoUrl("");
    setShowcasePublished(false);
    setRenderStatus("");
    setStatus("새 프로젝트를 시작했습니다.");
    setError("");
  }

  function applyLocalTranslation() {
    if (productName.trim().length < 2 && chineseKeyword.trim().length < 2) {
      setError("상품명 또는 중국어 검색어를 두 글자 이상 입력해주세요.");
      return;
    }
    const translated = localTranslate(chineseKeyword.trim() || productName);
    const nextKeywords = [translated.name, ...translated.keywords];
    setChineseKeyword(translated.name);
    setChineseKeywords(nextKeywords);
    setKeywordSignals(seedKeywordSignals(nextKeywords.map((keyword, index) => ({
      keyword,
      koreanMeaning: index === 0 ? productName.trim() || "대표 상품명" : `인기 검색 확장 ${index}`,
      intent: index === 0 ? "product" : index % 2 ? "review" : "problem",
    })), productName));
    setStatus(translated.source === "dictionary" ? "내장 사전 검색어를 인기 우선순위로 정렬했습니다." : "무료 중국어 검색 경로와 인기 우선순위를 준비했습니다.");
    setError("");
  }

  async function tryAiTranslation() {
    if (productName.trim().length < 2) return applyLocalTranslation();
    setBusy("translate");
    setError("");
    try {
      const response = await fetch("/api/china-video-lab/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: productName.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "AI 번역 실패");
      const name = String(data.translatedProductName || "").trim();
      const rawKeywords = Array.isArray(data.keywords) ? data.keywords as Array<Record<string, unknown>> : [];
      const translatedItems = rawKeywords.map((item) => ({
        keyword: String(item.simplifiedChinese || "").trim(),
        koreanMeaning: String(item.koreanMeaning || "").trim(),
        intent: String(item.intent || "product").trim(),
      })).filter((item) => item.keyword);
      if (!name) throw new Error("중국어 상품명이 비어 있습니다.");
      const items = [{ keyword: name, koreanMeaning: productName.trim(), intent: "product" }, ...translatedItems];
      const nextKeywords = Array.from(new Set(items.map((item) => item.keyword)));
      setChineseKeyword(name);
      setChineseKeywords(nextKeywords);
      setKeywordSignals(seedKeywordSignals(items, productName));
      setStatus(data.warning ? `AI 보완 검색어를 인기 우선순위로 정리했습니다. ${data.warning}` : "AI가 중국어 검색어와 우선순위를 만들었습니다.");
    } catch (cause) {
      applyLocalTranslation();
      setStatus(`AI 사용 불가 → 내장 사전으로 자동 전환했습니다. ${cause instanceof Error ? cause.message : ""}`.trim());
    } finally {
      setBusy(null);
    }
  }

  function openPlatform(platform: "douyin" | "xiaohongshu", keyword = chineseKeyword) {
    const query = encodeURIComponent(keyword || localTranslate(productName).name);
    const url = platform === "douyin"
      ? `https://www.douyin.com/search/${query}`
      : `https://www.xiaohongshu.com/search_result?keyword=${query}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function requestEdgeSearch() {
    const query = chineseKeyword.trim() || localTranslate(productName).name;
    if (!query) return;
    window.postMessage({
      source: APP_SOURCE,
      type: "GY_CHINA_CONNECTOR_SEARCH",
      requestId: window.crypto.randomUUID(),
      query,
      platform: "all",
      limit: 16,
    }, window.location.origin);
    setStatus("Edge 로그인 계정 검색을 시작했습니다. 열린 도우인·샤오홍슈 화면에서 로그인·보안 확인을 완료해주세요.");
  }

  async function searchPublicSources() {
    const query = chineseKeyword.trim() || localTranslate(productName).name;
    if (!query) return;
    setBusy("public-search");
    setError("");
    try {
      const response = await fetch("/api/china-video-lab/public-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: productName || query,
          translatedProductName: query,
          keywords: chineseKeywords.map((item) => ({ simplifiedChinese: item, koreanMeaning: "검색 확장어", intent: "product" })),
          platform: "all",
          limit: 12,
        }),
      });
      const data = await response.json();
      const results = Array.isArray(data.results) ? data.results as SearchResult[] : [];
      setSearchResults((current) => Array.from(new Map([...results, ...current].map((item) => [item.url, item])).values()));
      setStatus(results.length ? `공개 웹에서 참고 카드 ${results.length}개를 찾았습니다.` : "공개 결과는 없었습니다. 원문 또는 Edge 계정 검색을 사용하세요.");
    } catch (cause) {
      setStatus(`공개검색은 건너뛰었습니다. 원문·Edge 검색은 계속 사용할 수 있습니다. ${cause instanceof Error ? cause.message : ""}`.trim());
    } finally {
      setBusy(null);
    }
  }

  async function selectVideos(fileList: FileList | null) {
    const files = Array.from(fileList || []).slice(0, 8);
    if (!files.length) return;
    setBusy("video-read");
    setError("");
    try {
      const added: LocalSource[] = [];
      for (const file of files) {
        if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) throw new Error(`${file.name}: MP4, WEBM, MOV 형식만 사용할 수 있습니다.`);
        if (file.size > 500 * 1024 * 1024) throw new Error(`${file.name}: 500MB 이하 영상만 사용할 수 있습니다.`);
        const duration = await getVideoDuration(file);
        const previewUrl = URL.createObjectURL(file);
        added.push({
          id: uid("source"),
          kind: "local-video",
          platform: "owned",
          title: file.name.replace(/\.[^.]+$/, ""),
          url: "",
          previewUrl,
          file,
          duration,
          trimStart: 0,
          trimEnd: duration,
          rightsStatus: "owned",
          useInFinal: true,
          thumbnailUrl: "",
          needsReconnect: false,
        });
      }
      setSources((current) => [...current.filter((item) => !item.needsReconnect), ...added].slice(0, 20));
      setEditCuts([]);
      setMixSummary("");
      setStatus(`${added.length}개 영상을 읽었습니다. 인기 키워드 우선 AI 짜집기를 실행할 준비가 됐습니다.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "영상을 읽지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  function addResearchLink(result?: SearchResult) {
    const url = result?.url || sourceUrl.trim();
    if (!url.startsWith("https://")) {
      setError("HTTPS 영상 페이지 주소를 입력해주세요.");
      return;
    }
    const platform: Platform = url.includes("xiaohongshu") || url.includes("xhslink") ? "xiaohongshu" : url.includes("douyin") ? "douyin" : "other";
    if (sources.some((item) => item.url === url)) {
      setStatus("이미 소스함에 담긴 주소입니다.");
      return;
    }
    const reference: LocalSource = {
      id: uid("research"),
      kind: "research-link",
      platform,
      title: result?.title || sourceTitle.trim() || "참고 영상 페이지",
      url,
      previewUrl: "",
      duration: 0,
      trimStart: 0,
      trimEnd: 0,
      rightsStatus: "unverified",
      useInFinal: false,
      thumbnailUrl: result?.thumbnailUrl || "",
    };
    setSources((current) => [...current, reference].slice(0, 20));
    setSourceUrl("");
    setSourceTitle("");
    setStatus("검색 링크를 장면·훅 분석용으로 담았습니다. 원본 영상은 권리 확인 없이 최종 합성하지 않습니다.");
    setError("");
  }

  function patchSource(id: string, patch: Partial<LocalSource>) {
    setSources((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function removeSource(id: string) {
    setSources((current) => {
      const found = current.find((item) => item.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    setEditCuts((current) => retimeCuts(current.filter((cut) => cut.sourceId !== id)));
  }

  function moveSource(id: string, direction: -1 | 1) {
    setSources((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index < 0) return current;
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function analyzePopularKeywords() {
    const next = scoreKeywordSignals(chineseKeywords, searchResults, keywordSignals, productName);
    setKeywordSignals(next);
    const top = next.slice(0, 3).map((item) => `${item.keyword} ${item.score}점`).join(" · ");
    setStatus(top ? `인기 키워드 우선 분석 완료: ${top}` : "먼저 중국어 검색어를 만들어주세요.");
    setError("");
  }

  function toggleKeywordSignal(keyword: string) {
    setKeywordSignals((current) => current.map((item) => (
      item.keyword === keyword ? { ...item, selected: !item.selected } : item
    )));
  }

  function applyLocalPopularMix() {
    if (!finalSources.length) {
      setError("STEP 02에서 직접 촬영 또는 사용 허가 영상을 먼저 올려주세요.");
      return;
    }
    const cuts = buildLocalEditCuts(finalSources, targetDuration, selectedKeywordSignals, productName);
    setEditCuts(cuts);
    setCues(cutsToCues(cuts));
    setMixSummary(`무료 인기 우선 엔진이 상위 키워드 ${selectedKeywordSignals.slice(0, 3).map((item) => item.keyword).join(", ") || "상품 사용 흐름"}를 기준으로 ${cuts.length}컷을 만들었습니다.`);
    setStatus("API 비용 없이 인기 키워드 우선 판매형 타임라인을 만들었습니다.");
    setError("");
  }

  function patchEditCut(id: string, patch: Partial<EditCut>) {
    setEditCuts((current) => retimeCuts(current.map((cut) => {
      if (cut.id !== id) return cut;
      const source = finalSources.find((item) => item.id === (patch.sourceId || cut.sourceId));
      const sourceStartSecond = source
        ? clamp(Number(patch.sourceStartSecond ?? cut.sourceStartSecond), source.trimStart, Math.max(source.trimStart, source.trimEnd - .7))
        : Number(patch.sourceStartSecond ?? cut.sourceStartSecond);
      return {
        ...cut,
        ...patch,
        durationSeconds: clamp(Number(patch.durationSeconds ?? cut.durationSeconds), .7, 2.5),
        sourceStartSecond,
      };
    })));
  }

  function moveEditCut(id: string, direction: -1 | 1) {
    setEditCuts((current) => {
      const index = current.findIndex((cut) => cut.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return retimeCuts(next);
    });
  }

  function duplicateEditCut(id: string) {
    setEditCuts((current) => {
      const index = current.findIndex((cut) => cut.id === id);
      if (index < 0 || current.length >= 30) return current;
      const copy = { ...current[index], id: uid("cut"), locked: false, reason: `${current[index].reason} · 복제 후 수정` };
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return retimeCuts(next);
    });
  }

  function removeEditCut(id: string) {
    setEditCuts((current) => retimeCuts(current.filter((cut) => cut.id !== id)));
  }

  function fitEditedTimeline() {
    if (!editCuts.length) return applyLocalPopularMix();
    const fitted = fitCutsToDuration(editCuts, targetDuration);
    setEditCuts(fitted);
    setCues(cutsToCues(fitted));
    setStatus(`${targetDuration}초에 맞게 잠금되지 않은 컷 길이를 재배분했습니다.`);
  }

  async function requestAiRemix() {
    if (!finalSources.length) {
      setError("AI 짜집기에 사용할 직접 촬영·허가 영상을 먼저 올려주세요.");
      return;
    }
    if (!keywordSignals.length) analyzePopularKeywords();

    setBusy("ai-remix");
    setError("");
    setStatus("인기 키워드 점수와 현재 수정 내용을 기준으로 판매형 컷을 다시 설계하고 있습니다.");

    try {
      const response = await fetch("/api/revenue-shorts/ai-remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim(),
          productDescription: productDescription.trim(),
          targetDuration,
          mode: remixMode,
          popularFirst,
          instruction: remixInstruction.trim(),
          keywordSignals: rankedKeywordSignals,
          sources: finalSources.map((source) => ({
            id: source.id,
            title: source.title,
            duration: source.duration,
            trimStart: source.trimStart,
            trimEnd: source.trimEnd,
          })),
          currentCuts: editCuts,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "AI 짜집기 수정 실패");

      const nextCuts = retimeCuts((Array.isArray(data.cuts) ? data.cuts : []).map((cut: Record<string, unknown>, index: number): EditCut => ({
        id: uid(`ai-cut-${index}`),
        order: index + 1,
        startSecond: 0,
        durationSeconds: clamp(Number(cut.durationSeconds) || 1.5, .7, 2.5),
        sourceId: String(cut.sourceId || finalSources[index % finalSources.length]?.id || ""),
        sourceStartSecond: Math.max(0, Number(cut.sourceStartSecond) || 0),
        role: String(cut.role || "demo"),
        priorityKeyword: String(cut.priorityKeyword || ""),
        subtitleIntent: String(cut.subtitleIntent || ""),
        direction: String(cut.direction || ""),
        reason: String(cut.reason || ""),
        locked: Boolean(cut.locked),
      })));

      const fitted = fitCutsToDuration(nextCuts, targetDuration);
      setEditCuts(fitted);
      setCues(cutsToCues(fitted));
      setMixSummary(String(data.summary || `${data.engine === "ai" ? "AI" : "무료 보완 엔진"}이 ${fitted.length}컷을 만들었습니다.`));
      setStatus(data.warning
        ? `AI 응답이 불안정해 무료 보완 엔진으로 완성했습니다. ${data.warning}`
        : `인기 키워드 우선 ${data.engine === "ai" ? "AI" : "무료"} 짜집기 수정이 완료됐습니다.`);
    } catch (cause) {
      applyLocalPopularMix();
      setStatus(`AI 사용 불가 → 무료 인기 우선 엔진으로 자동 전환했습니다. ${cause instanceof Error ? cause.message : ""}`.trim());
    } finally {
      setBusy(null);
    }
  }

  function autoFitTimeline() {
    if (!finalSources.length) {
      setError("먼저 직접 촬영 또는 사용 허가 영상을 올려주세요.");
      return;
    }
    setSources((current) => current.map((source) => {
      if (!source.useInFinal || source.kind !== "local-video") return source;
      return { ...source, trimStart: clamp(source.trimStart, 0, Math.max(0, source.duration - .7)), trimEnd: source.duration };
    }));
    applyLocalPopularMix();
  }

  function regenerateScript() {
    if (!productName.trim()) {
      setError("상품명을 먼저 입력해주세요.");
      return;
    }
    if (editCuts.length) {
      setCues(cutsToCues(editCuts));
      setStatus("수정한 컷 순서와 인기 키워드 의도에 맞춰 대본·자막 시간을 다시 연결했습니다.");
    } else {
      setCues(generateLocalScript(productName, productDescription, targetDuration));
      setStatus("API 비용 없이 한국형 5단계 쇼핑 대본과 자막 시간을 만들었습니다.");
    }
    setError("");
  }

  function patchCue(id: string, patch: Partial<ScriptCue>) {
    setCues((current) => current.map((cue) => cue.id === id ? { ...cue, ...patch } : cue));
  }

  function previewSpeech() {
    const text = cues.map((cue) => cue.text).join(" ").trim();
    if (!text || !("speechSynthesis" in window)) {
      setError("이 브라우저에서는 무료 음성 미리듣기를 사용할 수 없습니다.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 1.05;
    utterance.pitch = 1;
    const korean = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("ko"));
    if (korean) utterance.voice = korean;
    window.speechSynthesis.speak(utterance);
    setStatus("브라우저 무료 TTS 미리듣기를 재생합니다. 최종 MP4에는 업로드한 음성 파일 또는 유료 TTS가 사용됩니다.");
  }

  async function drawThumbnail() {
    const source = finalSources.find((item) => item.file);
    const canvas = canvasRef.current;
    if (!source?.file || !canvas) {
      setError("썸네일을 만들려면 현재 브라우저에서 다시 연결된 영상 파일이 필요합니다.");
      return;
    }
    setBusy("thumbnail");
    try {
      const url = URL.createObjectURL(source.file);
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("썸네일 프레임을 읽지 못했습니다."));
      });
      video.currentTime = Math.min(Math.max(source.trimStart + .3, 0), Math.max(0, video.duration - .05));
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("썸네일 프레임 이동 실패"));
      });
      canvas.width = 1080;
      canvas.height = 1920;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("캔버스를 사용할 수 없습니다.");
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      const gradient = context.createLinearGradient(0, canvas.height * .45, 0, canvas.height);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,.88)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#79f0ff";
      context.font = "900 54px sans-serif";
      context.fillText(thumbnailAccent.slice(0, 18), 72, 1420);
      context.fillStyle = "#ffffff";
      context.font = "900 92px sans-serif";
      const words = thumbnailHeadline.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const trial = `${line} ${word}`.trim();
        if (context.measureText(trial).width > 930 && line) {
          lines.push(line);
          line = word;
        } else line = trial;
      }
      if (line) lines.push(line);
      lines.slice(0, 3).forEach((item, index) => context.fillText(item, 72, 1535 + index * 110));
      context.fillStyle = "#ffffff";
      context.font = "700 34px sans-serif";
      context.fillText("GY LABS · SHOPPING SHORTS", 72, 1860);
      URL.revokeObjectURL(url);
      setThumbnailReady(true);
      setStatus("영상 프레임으로 9:16 썸네일을 만들었습니다.");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "썸네일 생성 실패");
    } finally {
      setBusy(null);
    }
  }

  function downloadThumbnail() {
    const canvas = canvasRef.current;
    if (!canvas || !thumbnailReady) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slug(productName)}-thumbnail.png`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  function splitCuts(references: Array<{ id: string; trimStart: number; trimEnd: number }>) {
    const cuts: Array<Record<string, unknown>> = [];
    let timeline = 0;
    let remaining = targetDuration;
    let cursor = 0;
    while (remaining > .05 && references.length && cuts.length < 60) {
      const reference = references[cursor % references.length];
      const available = Math.max(.7, reference.trimEnd - reference.trimStart);
      const take = Math.min(2.5, available, remaining);
      const cycleOffset = Math.floor(cursor / references.length) * 2.5;
      const sourceStart = Math.min(Math.max(reference.trimStart, reference.trimStart + cycleOffset), Math.max(reference.trimStart, reference.trimEnd - .7));
      cuts.push({
        order: cuts.length + 1,
        startSecond: Number(timeline.toFixed(2)),
        durationSeconds: Number(take.toFixed(2)),
        sourceStartSecond: Number(sourceStart.toFixed(2)),
        sourceEndSecond: Number(Math.min(reference.trimEnd, sourceStart + take).toFixed(2)),
        referenceId: reference.id,
        frameIndex: cuts.length,
        role: cuts.length === 0 ? "hook" : remaining <= 2.5 ? "cta" : cuts.length % 3 === 0 ? "proof" : "demo",
        decision: "use-licensed",
        direction: "직접 촬영·허가 영상의 핵심 사용 장면을 세로 화면에 맞춰 연결",
        subtitleIntent: cues[Math.min(cues.length - 1, Math.floor((timeline / Math.max(1, targetDuration)) * cues.length))]?.text || "",
      });
      timeline += take;
      remaining -= take;
      cursor += 1;
    }
    return cuts;
  }

  async function uploadAudio(file: File | null, purpose: "voice" | "music") {
    if (!file) return "";
    const form = new FormData();
    form.append("audio", file);
    form.append("purpose", purpose);
    const response = await fetch("/api/revenue-shorts/audio-upload", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || `${purpose} 업로드 실패`);
    return String(data.audioUrl || "");
  }

  async function uploadReferenceFrame(frame: File) {
    const form = new FormData();
    form.append("images", frame);
    const response = await fetch("/api/creative-studio-pro/references", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok || !data.success || !data.urls?.[0]) throw new Error(data.message || "대표 이미지 업로드 실패");
    return String(data.urls[0]);
  }

  async function uploadVideoFile(file: File) {
    const ticketResponse = await fetch("/api/creative-studio-pro/reference-videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
    });
    const ticket = await ticketResponse.json();
    if (!ticketResponse.ok || !ticket.success) throw new Error(ticket.message || "영상 업로드 준비 실패");
    const supabase = createBrowserSupabaseClient();
    const { error: uploadError } = await supabase.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`영상 업로드 실패: ${uploadError.message}`);
    return String(ticket.publicUrl);
  }

  async function pollProject(projectId: string) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 1000 : 4000));
      const response = await fetch(`/api/creative-studio-pro/projects/${projectId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) continue;
      const job = data.renderJob as { status?: string; output_url?: string; error_message?: string } | null;
      if (data.project?.final_video_url) {
        setFinalVideoUrl(String(data.project.final_video_url));
        setShowcasePublished(data.project?.settings?.publicShowcase === true);
        setRenderStatus("완성");
        setStatus("최종 MP4가 완성되었습니다. 같은 화면에서 다운로드할 수 있습니다.");
        return;
      }
      if (job?.status === "failed") throw new Error(job.error_message || "FFmpeg 렌더링 실패");
      setRenderStatus(job?.status === "rendering" ? "FFmpeg 합성 중" : "렌더링 대기 중");
    }
    throw new Error("렌더링 확인 시간이 길어졌습니다. 생성 이력에서 상태를 확인해주세요.");
  }

  async function renderFinalMp4() {
    if (!productName.trim()) {
      setError("상품명을 입력해주세요.");
      setCurrentStep(1);
      return;
    }
    const usable = finalSources.filter((item) => item.file && !item.needsReconnect);
    if (!usable.length) {
      setError("최종 MP4를 만들려면 직접 촬영·허가 영상 파일을 현재 브라우저에서 다시 선택해주세요.");
      setCurrentStep(2);
      return;
    }
    const activeCues = cues.length ? cues : generateLocalScript(productName, productDescription, targetDuration);
    if (!cues.length) setCues(activeCues);
    const renderCommercePackage = buildCommercePackage({
      productName,
      affiliateUrl,
      cues: activeCues,
      title: title.trim() || `${productName} 써보면 바로 느끼는 차이`,
      description: description.trim() || `${productName}의 핵심 사용 장면과 장점을 확인해보세요.`,
      hashtags,
      thumbnailHeadline,
    });
    setBusy("render");
    setError("");
    setFinalVideoUrl("");
    try {
      setRenderStatus("대표 이미지 준비");
      setStatus("대표 프레임을 준비하고 있습니다.");
      const frame = await frameFileFromVideo(usable[0].file!);
      const frameUrl = await uploadReferenceFrame(frame);

      setRenderStatus("프로젝트 생성");
      const createResponse = await fetch("/api/creative-studio-pro/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: projectName.trim() || `${productName} 수익 쇼츠`,
          productName: productName.trim(),
          productDescription: productDescription.trim(),
          productUrl: affiliateUrl.trim(),
          affiliateUrl: affiliateUrl.trim(),
          masterPrompt: `직접 촬영 또는 사용 허가 영상만 사용한다. 인기 키워드 우선순위 ${selectedKeywordSignals.map((item) => `${item.keyword}(${item.score})`).join(", ")}를 첫 3초 훅과 실제 사용 장면에 반영하고 15~30초 판매형 세로 쇼츠로 만든다.`,
          sourceMode: "single-photo-commerce",
          sourceImageUrl: frameUrl,
          referenceImageUrls: [frameUrl],
          duration: targetDuration,
          ratio: aspectRatio === "9:16" ? "720:1280" : "1280:720",
          style: template,
          subtitleMode: "korean",
          voiceMode: voiceFile ? "female" : "none",
          voicePreset: "marin",
          musicMood: musicFile ? "custom" : "none",
          subtitleStyle,
          thumbnailStyle: "benefit-arrow",
          sfxMode: "none",
          platformTargets: ["youtube", "instagram"],
          qualityThreshold: 85,
          maxImageRetries: 1,
        }),
      });
      const created = await createResponse.json();
      if (!createResponse.ok || !created.success) throw new Error(created.message || "프로젝트 생성 실패");
      const projectId = String(created.project.id);
      setServerProjectId(projectId);

      setRenderStatus("영상 업로드");
      setStatus(`${usable.length}개 직접 촬영·허가 영상을 Supabase에 올리고 있습니다.`);
      const uploaded = [] as Array<{ source: LocalSource; url: string; id: string }>;
      for (const [index, source] of usable.entries()) {
        const url = await uploadVideoFile(source.file!);
        uploaded.push({ source, url, id: `revenue-source-${Date.now()}-${index}` });
      }

      setRenderStatus("음성·음악 업로드");
      const [voiceAudioUrl, customMusicUrl] = await Promise.all([
        uploadAudio(voiceFile, "voice"),
        uploadAudio(musicFile, "music"),
      ]);

      const mediaReferences = uploaded.map(({ source, url, id }) => ({
        id,
        platform: "owned",
        url,
        title: source.title,
        assetKind: "video-file",
        rightsStatus: source.rightsStatus === "unverified" ? "owned" : source.rightsStatus,
        useInFinal: true,
        includeInMixAnalysis: true,
        notes: `GY Revenue Shorts OS 직접 촬영·허가 영상 · 인기 키워드 ${selectedKeywordSignals.map((item) => `${item.keyword}:${item.score}`).join(", ")}`,
        analysisFrameUrls: [],
        selectedKeywords: selectedKeywordSignals.map((item) => item.keyword).slice(0, 6),
        durationSeconds: source.duration,
        trimStartSecond: source.trimStart,
        trimEndSecond: source.trimEnd,
        createdAt: new Date().toISOString(),
      }));
      const sourceIdMap = new Map(uploaded.map(({ source, id }) => [source.id, id]));
      const sourceMap = new Map(finalSources.map((source) => [source.id, source]));
      const baseEditCuts = editCuts.length
        ? fitCutsToDuration(editCuts, targetDuration)
        : buildLocalEditCuts(finalSources, targetDuration, selectedKeywordSignals, productName);
      if (!baseEditCuts.length) throw new Error("최종 합성 컷이 없습니다. STEP 03에서 AI 짜집기 또는 무료 인기 우선 짜집기를 실행해주세요.");
      const cuts = retimeCuts(baseEditCuts).map((cut, index) => {
        const source = sourceMap.get(cut.sourceId);
        const referenceId = sourceIdMap.get(cut.sourceId);
        if (!source || !referenceId) throw new Error(`컷 ${index + 1}의 원본 영상 파일을 찾지 못했습니다.`);
        const durationSeconds = clamp(cut.durationSeconds, .7, 2.5);
        const sourceStartSecond = clamp(cut.sourceStartSecond, source.trimStart, Math.max(source.trimStart, source.trimEnd - .7));
        return {
          order: index + 1,
          startSecond: cut.startSecond,
          durationSeconds,
          sourceStartSecond,
          sourceEndSecond: Math.min(source.trimEnd, sourceStartSecond + durationSeconds),
          referenceId,
          frameIndex: index,
          role: cut.role,
          decision: "use-licensed",
          direction: cut.direction,
          subtitleIntent: cut.subtitleIntent,
        };
      });

      setRenderStatus("인기 키워드 우선 컷 계획 저장");
      const planResponse = await fetch(`/api/revenue-shorts/projects/${projectId}/manual-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaReferences,
          cuts,
          commercePackage: renderCommercePackage,
          durationSeconds: targetDuration,
          voiceAudioUrl,
          customMusicUrl,
          musicVolume,
          subtitleStyle,
          subtitleCleanupMode,
          playbackSpeed,
        }),
      });
      const planData = await planResponse.json();
      if (!planResponse.ok || !planData.success) throw new Error(planData.message || "무료 렌더 계획 저장 실패");

      setRenderStatus("Render Worker 요청");
      const renderResponse = await fetch(`/api/creative-studio-pro/projects/${projectId}/render`, { method: "POST" });
      const renderData = await renderResponse.json();
      if (!renderResponse.ok || !renderData.success) throw new Error(renderData.message || "최종 MP4 렌더링 요청 실패");
      setStatus("FFmpeg Worker가 직접 촬영·허가 영상, 한국어 자막, 음성, 음악을 합성하고 있습니다.");
      await pollProject(projectId);
    } catch (cause) {
      setRenderStatus("실패");
      setError(cause instanceof Error ? cause.message : "최종 MP4 생성 실패");
    } finally {
      setBusy(null);
    }
  }


  async function updateShowcaseVisibility(publish: boolean) {
    if (!serverProjectId || !finalVideoUrl) {
      setError("완성 MP4가 만들어진 뒤 사이트 공개를 설정할 수 있습니다.");
      return;
    }

    setBusy("showcase");
    setError("");

    try {
      const response = await fetch(`/api/revenue-shorts/projects/${serverProjectId}/showcase`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publish,
          title: title.trim() || `${productName} 실제 사용 쇼핑 쇼츠`,
          description: description.trim() || productDescription.trim(),
          affiliateUrl: affiliateUrl.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "사이트 영상 공개 설정 실패");
      setShowcasePublished(Boolean(data.publicShowcase));
      setStatus(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "사이트 영상 공개 설정 실패");
    } finally {
      setBusy(null);
    }
  }

  function downloadProjectPackage() {
    const packageData = {
      version: "GY Revenue Shorts OS 1.0.0",
      savedAt: new Date().toISOString(),
      project: { projectName, productName, productDescription, affiliateUrl, chineseKeyword, targetDuration, aspectRatio, template },
      popularKeywordSignals: rankedKeywordSignals,
      researchSources: sources.filter((item) => item.kind === "research-link").map(sourceToPersisted),
      editSources: finalSources.map(sourceToPersisted),
      editCuts,
      mixSummary,
      script: cues,
      subtitleSrt: cuesToSrt(cues),
      commercePackage,
      render: { serverProjectId, renderStatus, finalVideoUrl },
    };
    downloadBlob(`${slug(productName)}-gy-revenue-shorts-package.json`, JSON.stringify(packageData, null, 2), "application/json;charset=utf-8");
  }

  function renderStepContent() {
    if (currentStep === 1) return (
      <section className={styles.workspacePanel}>
        <div className={styles.sectionHeader}>
          <div><span>STEP 01</span><h2>상품과 수익 목표를 먼저 정합니다</h2><p>AI 결제 여부와 관계없이 내장 사전과 직접 입력으로 다음 단계까지 진행할 수 있습니다.</p></div>
          <div className={styles.modeBadge}>무료 기본 모드 우선</div>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>프로젝트 이름</span><input value={projectName} onChange={(event) => setProjectName(event.target.value)} /></label>
          <label className={styles.field}><span>상품명</span><input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="예: 휴대용 손선풍기" /></label>
          <label className={`${styles.field} ${styles.wide}`}><span>상품 설명·실제 장점</span><textarea value={productDescription} onChange={(event) => setProductDescription(event.target.value)} placeholder="확인한 특징과 사용 장면만 적어주세요. 과장 문구는 자동으로 만들지 않습니다." /></label>
          <label className={`${styles.field} ${styles.wide}`}><span>제휴 링크</span><input value={affiliateUrl} onChange={(event) => setAffiliateUrl(event.target.value)} placeholder="쿠팡·Temu·기타 제휴 링크" /></label>
          <label className={styles.field}><span>목표 길이</span><select value={targetDuration} onChange={(event) => setTargetDuration(Number(event.target.value))}>{[15, 20, 25, 30].map((value) => <option value={value} key={value}>{value}초</option>)}</select></label>
          <label className={styles.field}><span>화면 비율</span><select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as "9:16" | "16:9")}><option value="9:16">9:16 세로 쇼츠</option><option value="16:9">16:9 가로</option></select></label>
          <label className={styles.field}><span>판매 구조</span><select value={template} onChange={(event) => setTemplate(event.target.value)}><option value="problem-solution">문제 → 해결</option><option value="ugc-review">실사용 후기</option><option value="how-to">사용법</option><option value="cinematic-product">프리미엄 제품형</option></select></label>
          <label className={styles.field}><span>중국어 검색어</span><input value={chineseKeyword} onChange={(event) => setChineseKeyword(event.target.value)} placeholder="직접 입력해도 됩니다" /></label>
        </div>
        <div className={styles.actionRow}>
          <button className={styles.primaryButton} onClick={applyLocalTranslation}>무료 내장 사전으로 만들기</button>
          <button className={styles.secondaryButton} onClick={() => void tryAiTranslation()} disabled={busy === "translate"}>{busy === "translate" ? "AI 확인 중" : "AI 번역 선택 사용"}</button>
        </div>
        {rankedKeywordSignals.length > 0 && <div className={styles.keywordPriorityPanel}><div className={styles.keywordPriorityHead}><div><strong>인기 키워드 우선순위</strong><span>번역 순서와 실제 검색 결과 근거를 합산합니다.</span></div><button onClick={analyzePopularKeywords}>인기 점수 다시 계산</button></div><div className={styles.keywordSignalGrid}>{rankedKeywordSignals.map((item, index) => <button className={item.selected ? styles.keywordSelected : ""} key={item.keyword} onClick={() => toggleKeywordSignal(item.keyword)}><b>{index + 1}</b><span><strong>{item.keyword}</strong><small>{item.koreanMeaning} · {item.intent}</small></span><em>{item.score}점</em><i>{item.evidenceCount ? `검색 근거 ${item.evidenceCount}` : "번역 우선"}</i></button>)}</div></div>}
      </section>
    );

    if (currentStep === 2) return (
      <section className={styles.workspacePanel}>
        <div className={styles.sectionHeader}><div><span>STEP 02</span><h2>연구용 링크와 최종 합성용 파일을 분리합니다</h2><p>도우인·샤오홍슈 링크는 훅과 장면 구조 연구용입니다. 최종 영상에는 직접 촬영하거나 사용 허가를 확인한 파일만 들어갑니다.</p></div><div className={styles.countBadge}>{sources.length}/20</div></div>
        <div className={styles.searchDeck}>
          <div className={styles.searchHero}><strong>{chineseKeyword || localTranslate(productName).name}</strong><p>원문 검색은 API 비용 없이 바로 열립니다.</p><div className={styles.actionRow}><button className={styles.primaryButton} onClick={() => openPlatform("douyin")}>도우인 원문 검색</button><button className={styles.primaryButton} onClick={() => openPlatform("xiaohongshu")}>샤오홍슈 원문 검색</button><button className={styles.secondaryButton} onClick={requestEdgeSearch}>Edge 로그인 검색</button><button className={styles.secondaryButton} onClick={() => void searchPublicSources()} disabled={busy === "public-search"}>공개 웹 검색</button></div></div>
          <label className={styles.uploadZone}><input type="file" accept="video/mp4,video/webm,video/quicktime" multiple onChange={(event) => void selectVideos(event.target.files)} /><strong>직접 촬영·사용 허가 영상 올리기</strong><span>MP4 · WEBM · MOV / 파일당 최대 500MB / 여러 개 선택 가능</span></label>
        </div>
        <div className={styles.urlAdder}><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="참고 영상 제목" /><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="도우인·샤오홍슈 또는 참고 URL" /><button onClick={() => addResearchLink()}>링크 담기</button></div>
        {rankedSearchResults.length > 0 && <><div className={styles.popularResultHead}><div><strong>인기 신호 우선 결과</strong><span>좋아요·저장·댓글·검색 순위가 확인되는 카드부터 정렬합니다.</span></div><button onClick={analyzePopularKeywords}>이 결과로 키워드 점수 반영</button></div><div className={styles.resultGrid}>{rankedSearchResults.map((item, index) => <article className={styles.resultCard} key={item.url}>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <div className={styles.resultPlaceholder}>{item.platform === "douyin" ? "抖音" : "小红书"}</div>}<div><small>우선 {index + 1} · 인기 신호 {resultPopularityScore(item)}점</small><strong>{item.title}</strong><p>{item.platform} · {item.popularityLabel || "참고 결과"}</p><div className={styles.miniActions}><a href={item.url} target="_blank" rel="noreferrer">원문</a><button onClick={() => addResearchLink(item)}>소스함</button></div></div></article>)}</div></>}
        <div className={styles.sourceList}>{sources.map((source, index) => <article className={`${styles.sourceCard} ${source.kind === "local-video" ? styles.finalSource : styles.researchSource}`} key={source.id}>
          <div className={styles.sourceMedia}>{source.previewUrl ? <video src={source.previewUrl} controls muted playsInline /> : source.thumbnailUrl ? <img src={source.thumbnailUrl} alt="" /> : <div>{source.needsReconnect ? "파일 재연결 필요" : "연구 링크"}</div>}</div>
          <div className={styles.sourceBody}><div className={styles.sourceMeta}><span>{index + 1}</span><small>{source.kind === "local-video" ? "최종 합성 가능" : "연구 전용"}</small></div><strong>{source.title}</strong><p>{source.kind === "local-video" ? `${source.duration.toFixed(1)}초 · ${source.rightsStatus}` : "원본 영상을 복제하지 않고 훅·촬영각도·판매 구조만 참고"}</p>
            {source.kind === "local-video" && <label className={styles.checkLine}><input type="checkbox" checked={source.useInFinal} onChange={(event) => patchSource(source.id, { useInFinal: event.target.checked })} />최종 MP4에 사용</label>}
            <div className={styles.miniActions}><button onClick={() => moveSource(source.id, -1)}>위</button><button onClick={() => moveSource(source.id, 1)}>아래</button>{source.url && <a href={source.url} target="_blank" rel="noreferrer">원문</a>}<button onClick={() => removeSource(source.id)}>삭제</button></div>
          </div>
        </article>)}</div>
      </section>
    );

    if (currentStep === 3) return (
      <section className={styles.workspacePanel}>
        <div className={styles.sectionHeader}>
          <div>
            <span>STEP 03 · AI REMIX EDITOR</span>
            <h2>인기 키워드부터 잡고, 컷을 직접 수정합니다</h2>
            <p>AI가 만든 결과를 그대로 쓰지 않습니다. 각 컷의 원본·시작점·길이·역할·키워드·자막을 대표님이 고치고 다시 AI 수정할 수 있습니다.</p>
          </div>
          <div className={styles.durationBadge}>
            <strong>{editTimelineDuration.toFixed(1)}초 / {targetDuration}초</strong>
            <span>{editCuts.length}개 편집 컷</span>
          </div>
        </div>

        <div className={styles.mixControlPanel}>
          <div className={styles.mixKeywordSummary}>
            <span>PRIORITY KEYWORDS</span>
            <div>{selectedKeywordSignals.length ? selectedKeywordSignals.map((item, index) => <button key={item.keyword} onClick={() => toggleKeywordSignal(item.keyword)}><b>{index + 1}</b><strong>{item.keyword}</strong><em>{item.score}점</em></button>) : <p>STEP 01에서 인기 키워드를 선택하세요.</p>}</div>
          </div>
          <div className={styles.mixOptions}>
            <label><span>AI 편집 방식</span><select value={remixMode} onChange={(event) => setRemixMode(event.target.value as RemixMode)}><option value="popular-first">인기 키워드 우선</option><option value="conversion-first">구매 전환 우선</option><option value="fast-cuts">빠른 템포 우선</option><option value="trust-first">신뢰·실사용 우선</option></select></label>
            <label className={styles.popularToggle}><input type="checkbox" checked={popularFirst} onChange={(event) => setPopularFirst(event.target.checked)} /><span>상위 인기 키워드를 첫 3초와 핵심 장면에 강제 반영</span></label>
            <label className={styles.mixInstruction}><span>AI 수정 지시</span><textarea value={remixInstruction} onChange={(event) => setRemixInstruction(event.target.value)} placeholder="예: 첫 3초를 더 강하게, 제품 디테일 컷을 2개 늘리고 CTA는 짧게" /></label>
          </div>
          <div className={styles.mixButtons}>
            <button className={styles.primaryButton} onClick={() => void requestAiRemix()} disabled={busy === "ai-remix"}>{busy === "ai-remix" ? "AI가 다시 편집 중..." : editCuts.length ? "현재 타임라인 AI 수정" : "인기 키워드 우선 AI 짜집기"}</button>
            <button className={styles.secondaryButton} onClick={applyLocalPopularMix}>무료 인기 우선 즉시 짜집기</button>
            <button className={styles.secondaryButton} onClick={fitEditedTimeline}>{targetDuration}초 길이 재맞춤</button>
          </div>
          {mixSummary && <div className={styles.mixSummary}>{mixSummary}</div>}
        </div>

        <div className={styles.editorToolbar}>
          <label>재생 속도<select value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value) as 1 | 1.2 | 1.4)}><option value={1}>1.0x</option><option value={1.2}>1.2x</option><option value={1.4}>1.4x</option></select></label>
          <label>중국어 자막 처리<select value={subtitleCleanupMode} onChange={(event) => setSubtitleCleanupMode(event.target.value as "safe-bottom-crop" | "keep-licensed")}><option value="safe-bottom-crop">하단 안전 크롭 후 한국어 자막 재생성</option><option value="keep-licensed">원본 화면 유지</option></select></label>
          <button onClick={autoFitTimeline}>원본 전체 구간으로 초기화</button>
        </div>

        {!finalSources.length ? (
          <div className={styles.emptyState}><strong>최종 합성용 영상이 없습니다</strong><p>STEP 02에서 직접 촬영 또는 사용 허가 영상을 올리고 ‘최종 MP4에 사용’을 선택하세요.</p></div>
        ) : !editCuts.length ? (
          <div className={styles.emptyState}><strong>편집 타임라인을 아직 만들지 않았습니다</strong><p>‘인기 키워드 우선 AI 짜집기’ 또는 ‘무료 인기 우선 즉시 짜집기’를 누르세요.</p></div>
        ) : (
          <div className={styles.cutEditorList}>
            {editCuts.map((cut, index) => {
              const source = finalSources.find((item) => item.id === cut.sourceId);
              return (
                <article className={`${styles.cutEditorCard} ${cut.locked ? styles.cutLocked : ""}`} key={cut.id}>
                  <div className={styles.cutOrder}>
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                    <span>{cut.startSecond.toFixed(1)}s</span>
                    <button onClick={() => patchEditCut(cut.id, { locked: !cut.locked })}>{cut.locked ? "잠금 해제" : "컷 잠금"}</button>
                  </div>
                  <div className={styles.cutVideo}>
                    {source?.previewUrl ? <video src={source.previewUrl} controls muted playsInline /> : <span>파일 재연결 필요</span>}
                  </div>
                  <div className={styles.cutFields}>
                    <label><span>원본 영상</span><select value={cut.sourceId} onChange={(event) => patchEditCut(cut.id, { sourceId: event.target.value, sourceStartSecond: finalSources.find((item) => item.id === event.target.value)?.trimStart || 0 })}>{finalSources.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                    <label><span>원본 시작</span><input type="number" step={.1} min={source?.trimStart || 0} max={source?.trimEnd || source?.duration || 0} value={cut.sourceStartSecond} onChange={(event) => patchEditCut(cut.id, { sourceStartSecond: Number(event.target.value) })} /></label>
                    <label><span>컷 길이</span><input type="number" step={.1} min={.7} max={2.5} value={cut.durationSeconds} onChange={(event) => patchEditCut(cut.id, { durationSeconds: Number(event.target.value) })} /></label>
                    <label><span>장면 역할</span><select value={cut.role} onChange={(event) => patchEditCut(cut.id, { role: event.target.value })}><option value="hook">첫 3초 훅</option><option value="problem">문제 제시</option><option value="demo">실제 사용</option><option value="detail">제품 디테일</option><option value="proof">전후·증거</option><option value="benefit">핵심 장점</option><option value="cta">상품 CTA</option></select></label>
                    <label><span>우선 키워드</span><select value={cut.priorityKeyword} onChange={(event) => patchEditCut(cut.id, { priorityKeyword: event.target.value })}><option value="">상품 흐름 우선</option>{rankedKeywordSignals.map((item) => <option value={item.keyword} key={item.keyword}>{item.keyword} · {item.score}점</option>)}</select></label>
                    <label className={styles.cutWide}><span>한국어 자막·대본</span><textarea value={cut.subtitleIntent} onChange={(event) => patchEditCut(cut.id, { subtitleIntent: event.target.value })} /></label>
                    <label className={styles.cutWide}><span>편집 방향</span><textarea value={cut.direction} onChange={(event) => patchEditCut(cut.id, { direction: event.target.value })} /></label>
                    <div className={styles.cutReason}><span>추천 이유</span><p>{cut.reason}</p></div>
                  </div>
                  <div className={styles.cutActions}>
                    <button onClick={() => moveEditCut(cut.id, -1)}>위</button>
                    <button onClick={() => moveEditCut(cut.id, 1)}>아래</button>
                    <button onClick={() => duplicateEditCut(cut.id)}>복제</button>
                    <button onClick={() => removeEditCut(cut.id)}>삭제</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );

    if (currentStep === 4) return (
      <section className={styles.workspacePanel}>
        <div className={styles.sectionHeader}><div><span>STEP 04</span><h2>수정한 컷과 인기 키워드에 맞춰 대본을 연결합니다</h2><p>STEP 03에서 고친 컷별 한국어 문장을 그대로 정확한 자막과 음성 흐름으로 사용합니다.</p></div><button className={styles.primaryButton} onClick={regenerateScript}>{editCuts.length ? "컷 기반 대본·자막 다시 연결" : "대본 다시 만들기"}</button></div>
        <div className={styles.scriptEditor}>{cues.map((cue, index) => <article className={styles.cueRow} key={cue.id}><span>{String(index + 1).padStart(2, "0")}</span><label>역할<input value={cue.role} onChange={(event) => patchCue(cue.id, { role: event.target.value })} /></label><label className={styles.cueText}>대본<textarea value={cue.text} onChange={(event) => patchCue(cue.id, { text: event.target.value })} /></label><label>시작<input type="number" step={.1} min={0} max={targetDuration} value={cue.start} onChange={(event) => patchCue(cue.id, { start: Number(event.target.value) })} /></label><label>종료<input type="number" step={.1} min={0} max={targetDuration} value={cue.end} onChange={(event) => patchCue(cue.id, { end: Number(event.target.value) })} /></label></article>)}</div>
        <div className={styles.audioDeck}><button className={styles.secondaryButton} onClick={previewSpeech}>브라우저 무료 TTS 미리듣기</button><label className={styles.fileButton}><input type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg" onChange={(event) => setVoiceFile(event.target.files?.[0] || null)} />최종 음성 파일 선택</label><span>{voiceFile ? voiceFile.name : "음성 파일이 없으면 최종 영상은 무음+자막으로 제작"}</span></div>
      </section>
    );

    if (currentStep === 5) return (
      <section className={styles.workspacePanel}>
        <div className={styles.sectionHeader}><div><span>STEP 05</span><h2>정확한 한국어 자막과 음악을 설정합니다</h2><p>CapCut 자동 자막을 사용하지 않고 현재 검수한 문장으로 SRT를 만듭니다.</p></div><button className={styles.primaryButton} onClick={() => downloadBlob(`${slug(productName)}.srt`, cuesToSrt(cues), "text/plain;charset=utf-8")}>SRT 다운로드</button></div>
        <div className={styles.subtitlePreview}>{cues.map((cue, index) => <div key={cue.id}><span>{formatClock(cue.start)} → {formatClock(cue.end)}</span><strong>{cue.text}</strong></div>)}</div>
        <div className={styles.formGrid}><label className={styles.field}><span>자막 스타일</span><select value={subtitleStyle} onChange={(event) => setSubtitleStyle(event.target.value as "bold-pop" | "minimal")}><option value="bold-pop">굵은 쇼핑 자막</option><option value="minimal">미니멀 자막</option></select></label><label className={styles.field}><span>배경음악 음량 {Math.round(musicVolume * 100)}%</span><input type="range" min={0} max={.5} step={.01} value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} /></label><label className={`${styles.field} ${styles.wide}`}><span>배경음악 파일</span><input type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg" onChange={(event) => setMusicFile(event.target.files?.[0] || null)} />{musicFile && <small>{musicFile.name}</small>}</label></div>
      </section>
    );

    if (currentStep === 6) return (
      <section className={styles.workspacePanel}>
        <div className={styles.sectionHeader}><div><span>STEP 06</span><h2>영상 장면으로 썸네일을 만듭니다</h2><p>직접 올린 영상의 첫 사용 구간을 9:16 캔버스에 배치하고 문구를 합성합니다.</p></div><div className={styles.actionRow}><button className={styles.primaryButton} onClick={() => void drawThumbnail()} disabled={busy === "thumbnail"}>영상 프레임으로 생성</button><button className={styles.secondaryButton} onClick={downloadThumbnail} disabled={!thumbnailReady}>PNG 다운로드</button></div></div>
        <div className={styles.thumbnailStudio}><div className={styles.thumbnailControls}><label className={styles.field}><span>메인 문구</span><input value={thumbnailHeadline} onChange={(event) => setThumbnailHeadline(event.target.value)} /></label><label className={styles.field}><span>강조 문구</span><input value={thumbnailAccent} onChange={(event) => setThumbnailAccent(event.target.value)} /></label><div className={styles.thumbnailTip}>문구를 바꾼 뒤 ‘영상 프레임으로 생성’을 다시 누르면 캔버스에 반영됩니다.</div></div><div className={styles.canvasShell}><canvas ref={canvasRef} /></div></div>
      </section>
    );

    return (
      <section className={styles.workspacePanel}>
        <div className={styles.sectionHeader}><div><span>STEP 07</span><h2>수익화 정보와 최종 MP4를 한 번에 출력합니다</h2><p>제목·설명·제휴 고지·해시태그는 API 없이 생성되며, MP4는 Supabase와 Render FFmpeg Worker를 사용합니다.</p></div><div className={styles.modeBadge}>AI 비용 0원 렌더 경로</div></div>
        <div className={styles.formGrid}><label className={`${styles.field} ${styles.wide}`}><span>쇼츠 제목</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className={`${styles.field} ${styles.wide}`}><span>설명</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className={`${styles.field} ${styles.wide}`}><span>해시태그</span><input value={hashtags} onChange={(event) => setHashtags(event.target.value)} /></label></div>
        <div className={styles.revenuePreview}><h3>{commercePackage.title}</h3><p>{commercePackage.description}</p><div>{commercePackage.hashtags.map((item) => <span key={item}>{item}</span>)}</div></div>
        <div className={styles.exportGrid}><button onClick={downloadProjectPackage}><strong>작업 패키지</strong><span>JSON · 대본 · SRT · 게시 문구</span></button><button onClick={() => downloadBlob(`${slug(productName)}.srt`, cuesToSrt(cues), "text/plain;charset=utf-8")}><strong>SRT 자막</strong><span>검수한 한국어 문장</span></button><button onClick={downloadThumbnail} disabled={!thumbnailReady}><strong>썸네일 PNG</strong><span>영상 장면 기반 9:16</span></button></div>
        <div className={styles.renderPanel}><div><span>REAL MP4 PIPELINE</span><h3>직접 촬영·허가 영상으로 최종 MP4 만들기</h3><p>영상 업로드 → 무료 수동 컷 계획 → 중국어 하단 안전 크롭 → 한국어 자막 → 음성·음악 → Render FFmpeg Worker → MP4</p></div><button className={styles.renderButton} onClick={() => void renderFinalMp4()} disabled={busy === "render"}>{busy === "render" ? renderStatus || "진행 중" : "최종 MP4 제작 시작"}</button></div>
        {serverProjectId && <div className={styles.renderStatus}><span>프로젝트 ID</span><code>{serverProjectId}</code><strong>{renderStatus}</strong></div>}
        {finalVideoUrl && (
          <div className={styles.publicationPanel}>
            <video src={finalVideoUrl} controls playsInline preload="metadata" />
            <div>
              <span>PUBLIC SALES SHOWCASE</span>
              <h3>내 사이트에서 완성 영상을 바로 재생합니다</h3>
              <p>공개하면 메인 대표 영상, 영상 포트폴리오, 연결된 추천 상품 화면에 자동 노출됩니다. 공개하지 않은 내부 테스트 영상은 고객에게 보이지 않습니다.</p>
              <div className={styles.publicationActions}>
                <button
                  className={styles.publishButton}
                  onClick={() => void updateShowcaseVisibility(!showcasePublished)}
                  disabled={busy === "showcase"}
                >
                  {busy === "showcase" ? "변경 중..." : showcasePublished ? "사이트 공개 해제" : "사이트 영상 전시장에 공개"}
                </button>
                <Link href="/showcase" target="_blank">공개 영상 페이지 보기</Link>
                <a href={finalVideoUrl} download target="_blank" rel="noreferrer">완성 MP4 열기·다운로드</a>
              </div>
              <strong className={showcasePublished ? styles.published : styles.privateVideo}>
                {showcasePublished ? "현재 고객에게 공개 중" : "현재 비공개 · 대표님만 확인 가능"}
              </strong>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className={styles.fullscreen}>
      <header className={styles.topbar}>
        <div className={styles.brand}><span>GY</span><div><strong>REVENUE SHORTS OS</strong><small>상품 하나에서 판매 가능한 쇼츠와 수익화 준비물까지</small></div></div>
        <div className={styles.topActions}><button onClick={resetProject}>새 프로젝트</button><Link href="/admin">회사 OS로 돌아가기</Link></div>
      </header>

      <aside className={styles.statusRail}>
        <div className={styles.projectSummary}><small>AUTO SAVE</small><strong>{projectName}</strong><span>{productName || "상품 미입력"}</span></div>
        <div className={styles.serviceCard}><strong>운영 연결 상태</strong><div><i className={health?.services?.supabase?.configured ? styles.ok : styles.warn} />Supabase<span>{health?.services?.supabase?.configured ? "준비" : "확인"}</span></div><div><i className={health?.services?.worker?.reachable ? styles.ok : styles.warn} />FFmpeg Worker<span>{health?.services?.worker?.reachable ? "연결" : "확인"}</span></div><div><i className={health?.services?.openai?.configured ? styles.ok : styles.optional} />OpenAI<span>{health?.services?.openai?.configured ? "선택 가능" : "선택 사항"}</span></div></div>
        <div className={styles.progressCard}><strong>출시 조건</strong><div><span>상품</span><b>{productName ? "완료" : "대기"}</b></div><div><span>허가 영상</span><b>{finalSources.length ? `${finalSources.length}개` : "대기"}</b></div><div><span>대본·SRT</span><b>{cues.length ? "완료" : "대기"}</b></div><div><span>썸네일</span><b>{thumbnailReady ? "완료" : "대기"}</b></div><div><span>최종 MP4</span><b>{finalVideoUrl ? "완료" : renderStatus || "대기"}</b></div></div>
        <div className={styles.principle}><strong>원칙</strong><p>API가 실패해도 작업은 계속됩니다. 타인의 원본 영상은 권리 확인 없이 최종 합성하지 않습니다.</p></div>
      </aside>

      <main className={styles.main}>
        <nav className={styles.stepNav}>{steps.map((step) => <button key={step.id} className={currentStep === step.id ? styles.activeStep : undefined} onClick={() => setCurrentStep(step.id)}><span>{step.number}</span><strong>{step.title}</strong><small>{step.subtitle}</small></button>)}</nav>
        <div className={styles.noticeBar}><div className={error ? styles.errorDot : styles.statusDot} /><strong>{error || status}</strong>{error && <button onClick={() => setError("")}>닫기</button>}</div>
        {renderStepContent()}
        <footer className={styles.stepFooter}><button onClick={() => setCurrentStep((Math.max(1, currentStep - 1)) as StepId)} disabled={currentStep === 1}>이전 단계</button><span>{currentStep} / 7</span><button onClick={() => setCurrentStep((Math.min(7, currentStep + 1)) as StepId)} disabled={currentStep === 7}>다음 단계</button></footer>
      </main>
    </div>
  );
}
