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
};

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
  const [hydrated, setHydrated] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const finalSources = useMemo(() => sources.filter((item) => item.kind === "local-video" && item.useInFinal), [sources]);
  const totalTrimmedDuration = useMemo(() => finalSources.reduce((sum, item) => sum + Math.max(.1, item.trimEnd - item.trimStart), 0), [finalSources]);
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
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, projectName, productName, productDescription, affiliateUrl, chineseKeyword, targetDuration, aspectRatio, template, currentStep, sources, cues, subtitleStyle, subtitleCleanupMode, playbackSpeed, thumbnailHeadline, thumbnailAccent, title, description, hashtags, musicVolume]);

  useEffect(() => {
    void fetch("/api/revenue-shorts/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

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
    setChineseKeyword(translated.name);
    setChineseKeywords([translated.name, ...translated.keywords]);
    setStatus(translated.source === "dictionary" ? "API 비용 없이 내장 상품 사전으로 중국어 검색어를 만들었습니다." : "무료 중국어 검색 경로를 준비했습니다.");
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
      const keywords = Array.isArray(data.keywords) ? data.keywords.map((item: Record<string, unknown>) => String(item.simplifiedChinese || "")).filter(Boolean) : [];
      if (!name) throw new Error("중국어 상품명이 비어 있습니다.");
      setChineseKeyword(name);
      setChineseKeywords(Array.from(new Set([name, ...keywords])));
      setStatus(data.warning ? `내장 보완 모드로 검색어를 만들었습니다. ${data.warning}` : "AI가 중국어 간체 검색어를 만들었습니다.");
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
      setStatus(`${added.length}개 영상을 읽었습니다. 최종 합성에는 직접 촬영·허가 영상만 사용됩니다.`);
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

  function autoFitTimeline() {
    if (!finalSources.length) {
      setError("먼저 직접 촬영 또는 사용 허가 영상을 올려주세요.");
      return;
    }
    const each = targetDuration / finalSources.length;
    setSources((current) => current.map((source) => {
      if (!source.useInFinal || source.kind !== "local-video") return source;
      const available = Math.max(.7, source.duration - source.trimStart);
      return { ...source, trimEnd: source.trimStart + Math.min(available, each) };
    }));
    setStatus(`${targetDuration}초 목표에 맞춰 영상별 사용 구간을 자동 배분했습니다.`);
    setError("");
  }

  function regenerateScript() {
    if (!productName.trim()) {
      setError("상품명을 먼저 입력해주세요.");
      return;
    }
    setCues(generateLocalScript(productName, productDescription, targetDuration));
    setStatus("API 비용 없이 한국형 5단계 쇼핑 대본과 자막 시간을 만들었습니다.");
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
          masterPrompt: "직접 촬영 또는 사용 허가 영상만 사용하고, 첫 3초 훅과 실제 사용 장면 중심으로 15~30초 세로형 쇼츠를 만든다.",
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
        notes: "GY Revenue Shorts OS에서 직접 촬영 또는 사용 허가를 확인한 영상",
        analysisFrameUrls: [],
        selectedKeywords: chineseKeywords.slice(0, 6),
        durationSeconds: source.duration,
        trimStartSecond: source.trimStart,
        trimEndSecond: source.trimEnd,
        createdAt: new Date().toISOString(),
      }));
      const cuts = splitCuts(uploaded.map(({ source, id }) => ({ id, trimStart: source.trimStart, trimEnd: source.trimEnd })));

      setRenderStatus("무료 컷 계획 저장");
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

  function downloadProjectPackage() {
    const packageData = {
      version: "GY Revenue Shorts OS 1.0.0",
      savedAt: new Date().toISOString(),
      project: { projectName, productName, productDescription, affiliateUrl, chineseKeyword, targetDuration, aspectRatio, template },
      researchSources: sources.filter((item) => item.kind === "research-link").map(sourceToPersisted),
      editSources: finalSources.map(sourceToPersisted),
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
        {chineseKeywords.length > 0 && <div className={styles.keywordBox}><strong>중국 검색어</strong><div>{chineseKeywords.map((item) => <button key={item} onClick={() => setChineseKeyword(item)}>{item}</button>)}</div></div>}
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
        {searchResults.length > 0 && <div className={styles.resultGrid}>{searchResults.map((item) => <article className={styles.resultCard} key={item.url}>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <div className={styles.resultPlaceholder}>{item.platform === "douyin" ? "抖音" : "小红书"}</div>}<div><small>{item.platform} · {item.popularityLabel || "참고 결과"}</small><strong>{item.title}</strong><div className={styles.miniActions}><a href={item.url} target="_blank" rel="noreferrer">원문</a><button onClick={() => addResearchLink(item)}>소스함</button></div></div></article>)}</div>}
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
        <div className={styles.sectionHeader}><div><span>STEP 03</span><h2>영상 순서와 사용할 구간을 정합니다</h2><p>FFmpeg Worker는 각 소스를 0.7~2.5초 컷으로 나누어 목표 길이에 맞게 반복·연결합니다.</p></div><div className={styles.durationBadge}><strong>{totalTrimmedDuration.toFixed(1)}초</strong><span>선택 구간 합계</span></div></div>
        <div className={styles.editorToolbar}><button className={styles.primaryButton} onClick={autoFitTimeline}>{targetDuration}초 자동 맞춤</button><label>재생 속도<select value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value) as 1 | 1.2 | 1.4)}><option value={1}>1.0x</option><option value={1.2}>1.2x</option><option value={1.4}>1.4x</option></select></label><label>중국어 자막 처리<select value={subtitleCleanupMode} onChange={(event) => setSubtitleCleanupMode(event.target.value as "safe-bottom-crop" | "keep-licensed")}><option value="safe-bottom-crop">하단 안전 크롭 후 한국어 자막 재생성</option><option value="keep-licensed">원본 화면 유지</option></select></label></div>
        <div className={styles.timeline}>{finalSources.length ? finalSources.map((source, index) => <article className={styles.timelineClip} key={source.id}><div className={styles.clipIndex}>{String(index + 1).padStart(2, "0")}</div><div className={styles.clipPreview}>{source.previewUrl ? <video src={source.previewUrl} controls muted playsInline /> : <span>파일 재연결 필요</span>}</div><div className={styles.clipControls}><strong>{source.title}</strong><div><label>시작<input type="number" min={0} max={source.duration} step={.1} value={source.trimStart} onChange={(event) => patchSource(source.id, { trimStart: clamp(Number(event.target.value), 0, source.trimEnd - .1) })} /></label><label>종료<input type="number" min={0} max={source.duration} step={.1} value={source.trimEnd} onChange={(event) => patchSource(source.id, { trimEnd: clamp(Number(event.target.value), source.trimStart + .1, source.duration) })} /></label></div><span>사용 구간 {(source.trimEnd - source.trimStart).toFixed(1)}초</span></div></article>) : <div className={styles.emptyState}><strong>최종 합성용 영상이 없습니다</strong><p>STEP 02에서 직접 촬영 또는 사용 허가 영상을 올리고 ‘최종 MP4에 사용’을 선택하세요.</p></div>}</div>
      </section>
    );

    if (currentStep === 4) return (
      <section className={styles.workspacePanel}>
        <div className={styles.sectionHeader}><div><span>STEP 04</span><h2>한국형 대본과 음성을 준비합니다</h2><p>대본·자막은 무료 규칙 기반으로 즉시 생성됩니다. 브라우저 TTS는 미리듣기용이며, MP3를 올리면 최종 MP4에 합성됩니다.</p></div><button className={styles.primaryButton} onClick={regenerateScript}>대본 다시 만들기</button></div>
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
        {finalVideoUrl && <a className={styles.downloadFinal} href={finalVideoUrl} download target="_blank" rel="noreferrer">완성 MP4 열기·다운로드</a>}
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
