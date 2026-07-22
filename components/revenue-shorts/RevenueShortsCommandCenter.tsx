"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import styles from "./RevenueShortsCommandCenter.module.css";

type SearchResult = {
  id: string;
  platform: "douyin" | "xiaohongshu";
  title: string;
  url: string;
  thumbnailUrl?: string;
  popularityLabel?: string;
  sourceMode?: string;
  nativeRank?: number | null;
  hashtags?: string[];
  engagement?: {
    likes?: number | null;
    comments?: number | null;
    saves?: number | null;
  };
  directVideoUrl?: string;
};

type PreviewState = {
  item: SearchResult;
  loading: boolean;
  mode: "direct-video" | "official-embed" | "platform-player" | "error";
  playbackUrl: string;
  message: string;
};

type LinkedSource = {
  id: string;
  resultId: string;
  title: string;
  file: File;
  previewUrl: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  rightsStatus: "owned" | "seller-provided" | "affiliate-provided" | "permission-confirmed";
};

type RemixCut = {
  id: string;
  order: number;
  sourceId: string;
  sourceStartSecond: number;
  durationSeconds: number;
  role: string;
  priorityKeyword: string;
  subtitleIntent: string;
  direction: string;
  reason: string;
  referenceVideoId: string;
};

type ImportedProduct = {
  name: string;
  description: string;
  imageUrl: string;
  originalImageUrl?: string;
  imageStored?: boolean;
  imageSource?: "storage" | "remote" | "none";
  priceText: string;
  discountText?: string;
  platform: string;
  finalUrl: string;
  resolvedUrl?: string;
  source: "database" | "coupang-api" | "page-metadata" | "link-only";
  warning?: string;
};

type RenderStatus = {
  projectId: string;
  status: string;
  finalVideoUrl: string;
};

const APP_SOURCE = "GY_NEXUS";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatMetric(value: number | null | undefined) {
  const number = Number(value) || 0;
  if (number >= 10_000) return `${(number / 10_000).toFixed(number >= 100_000 ? 0 : 1)}만`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}천`;
  return number ? String(number) : "-";
}

function popularityScore(result: SearchResult) {
  const likes = Math.max(0, Number(result.engagement?.likes) || 0);
  const saves = Math.max(0, Number(result.engagement?.saves) || 0);
  const comments = Math.max(0, Number(result.engagement?.comments) || 0);
  const engagementScore = Math.min(60, Math.log10(likes + saves * 2 + comments * 1.5 + 1) * 13);
  const rank = Math.max(1, Number(result.nativeRank) || 30);
  const rankScore = Math.max(0, 34 - rank * 2);
  return Math.round(Math.min(100, 12 + engagementScore + rankScore));
}

function localChineseKeyword(value: string) {
  const input = value.trim();
  const dictionary: Array<[RegExp, string]> = [
    [/손\s*선풍기|휴대용\s*선풍기/i, "手持小风扇"],
    [/세탁조|세탁기.*청소|세탁.*클리너/i, "洗衣机槽清洁剂"],
    [/키보드.*청소|키보드.*클리너/i, "键盘清洁工具"],
    [/보조\s*배터리/i, "充电宝"],
    [/무선.*이어폰|블루투스.*이어폰/i, "无线耳机"],
    [/태블릿|갤럭시\s*탭/i, "平板电脑"],
    [/USB.?C.*허브|USB.*허브/i, "USB-C扩展坞"],
    [/가습기/i, "加湿器"],
    [/제습기/i, "除湿机"],
    [/청소기/i, "家用吸尘器"],
    [/충전기|고속\s*충전/i, "快充充电器"],
    [/거치대/i, "手机支架"],
  ];
  return dictionary.find(([pattern]) => pattern.test(input))?.[1] || "实用好物";
}

async function videoDuration(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error(`${file.name} 영상 정보를 읽지 못했습니다.`));
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
    const scale = Math.min(1, 900 / Math.max(1, video.videoWidth));
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("브라우저 캔버스를 사용할 수 없습니다.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .9));
    if (!blob) throw new Error("대표 프레임을 만들지 못했습니다.");
    return new File([blob], "gy-source-frame.jpg", { type: "image/jpeg" });
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

function buildFallbackCuts(sources: LinkedSource[], selected: SearchResult[], duration: number): RemixCut[] {
  const roles = ["hook", "problem", "demo", "detail", "proof", "benefit", "cta"];
  const cuts: RemixCut[] = [];
  let cursor = 0;
  let index = 0;
  while (cursor < duration - .05 && cuts.length < 24) {
    const source = sources[index % sources.length];
    const result = selected[index % selected.length];
    const role = cuts.length === 0 ? "hook" : duration - cursor <= 2.2 ? "cta" : roles[1 + (index % (roles.length - 2))];
    const take = Number(Math.min(role === "hook" ? 1.4 : role === "cta" ? 2 : 1.6, duration - cursor).toFixed(2));
    const available = Math.max(.7, source.trimEnd - source.trimStart);
    const sourceStartSecond = Number((source.trimStart + ((index * 1.37) % Math.max(.01, available - take))).toFixed(2));
    cuts.push({
      id: uid("cut"),
      order: cuts.length + 1,
      sourceId: source.id,
      sourceStartSecond,
      durationSeconds: take,
      role,
      priorityKeyword: "",
      subtitleIntent: role === "hook"
        ? "첫 장면에서 가장 큰 차이를 보여드립니다."
        : role === "cta"
          ? "필요한 분은 상품 링크에서 확인하세요."
          : "실제 사용 장면으로 핵심 기능을 확인하세요.",
      direction: "선택한 중국 인기영상의 리듬을 참고해 새로운 판매 순서로 재구성",
      reason: `${result.title} · 인기 신호 ${popularityScore(result)}점 반영`,
      referenceVideoId: result.id,
    });
    cursor += take;
    index += 1;
  }
  return cuts;
}

export default function RevenueShortsCommandCenter() {
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [priceText, setPriceText] = useState("");
  const [platform, setPlatform] = useState("");
  const [chineseKeyword, setChineseKeyword] = useState("");
  const [targetDuration, setTargetDuration] = useState(20);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [sources, setSources] = useState<LinkedSource[]>([]);
  const [cuts, setCuts] = useState<RemixCut[]>([]);
  const [mixSummary, setMixSummary] = useState("");
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("제휴링크를 붙여넣거나 상품명을 직접 입력하세요.");
  const [error, setError] = useState("");
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewCutIndex, setPreviewCutIndex] = useState(0);
  const [render, setRender] = useState<RenderStatus>({ projectId: "", status: "", finalVideoUrl: "" });
  const mixVideoRef = useRef<HTMLVideoElement | null>(null);

  const selectedResults = useMemo(
    () => searchResults.filter((item) => selectedIds.includes(item.id)),
    [searchResults, selectedIds],
  );
  const rankedResults = useMemo(
    () => [...searchResults].sort((a, b) => popularityScore(b) - popularityScore(a)),
    [searchResults],
  );
  const currentPreviewCut = cuts[previewCutIndex] || null;
  const currentPreviewSource = currentPreviewCut
    ? sources.find((source) => source.id === currentPreviewCut.sourceId) || null
    : null;

  useEffect(() => {
    function receiveConnectorResults(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const payload = event.data as Record<string, unknown> | null;
      if (!payload || payload.source !== "GY_CHINA_CONNECTOR" || payload.type !== "GY_CHINA_CONNECTOR_RESULTS") return;
      const rows = Array.isArray(payload.results) ? payload.results : [];
      const normalized = rows.map((item, index): SearchResult => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const engagement = row.engagement && typeof row.engagement === "object"
          ? row.engagement as SearchResult["engagement"]
          : undefined;
        return {
          id: String(row.id || uid(`edge-${index}`)),
          platform: row.platform === "xiaohongshu" ? "xiaohongshu" : "douyin",
          title: String(row.title || "중국 인기영상"),
          url: String(row.url || ""),
          thumbnailUrl: String(row.thumbnailUrl || ""),
          popularityLabel: String(row.popularityLabel || "Edge 로그인 검색"),
          sourceMode: "browser-account",
          nativeRank: Number(row.nativeRank) || index + 1,
          hashtags: Array.isArray(row.hashtags) ? row.hashtags.map(String) : [],
          engagement,
          directVideoUrl: String(row.directVideoUrl || row.videoUrl || row.playUrl || ""),
        };
      }).filter((item) => item.url.startsWith("https://"));
      if (!normalized.length) return;
      setSearchResults((current) => Array.from(new Map([...normalized, ...current].map((item) => [item.url, item])).values()));
      setStatus(`Edge 로그인 검색에서 영상 ${normalized.length}개를 받았습니다.`);
    }
    window.addEventListener("message", receiveConnectorResults);
    window.postMessage({ source: APP_SOURCE, type: "GY_CHINA_CONNECTOR_PING" }, window.location.origin);
    return () => window.removeEventListener("message", receiveConnectorResults);
  }, []);

  useEffect(() => {
    const video = mixVideoRef.current;
    if (!previewPlaying || !video || !currentPreviewCut || !currentPreviewSource) return;

    let ended = false;
    const start = currentPreviewCut.sourceStartSecond;
    const end = start + currentPreviewCut.durationSeconds;
    video.src = currentPreviewSource.previewUrl;
    video.load();

    const onMetadata = () => {
      video.currentTime = Math.min(start, Math.max(0, video.duration - .05));
    };
    const onSeeked = () => {
      if (!ended) void video.play().catch(() => setPreviewPlaying(false));
    };
    const onTime = () => {
      if (video.currentTime < end - .03) return;
      video.pause();
      if (previewCutIndex >= cuts.length - 1) {
        setPreviewPlaying(false);
        setPreviewCutIndex(0);
      } else {
        setPreviewCutIndex((index) => index + 1);
      }
    };

    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("timeupdate", onTime);
    return () => {
      ended = true;
      video.pause();
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("timeupdate", onTime);
    };
  }, [previewPlaying, previewCutIndex, currentPreviewCut, currentPreviewSource, cuts.length]);

  async function importProduct() {
    if (!affiliateUrl.trim()) {
      setError("제휴링크를 먼저 붙여넣어 주세요.");
      return;
    }
    setBusy("product-import");
    setError("");
    setStatus("제휴링크에서 상품명·설명·이미지·가격을 확인하고 있습니다.");
    try {
      const response = await fetch("/api/revenue-shorts/product-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: affiliateUrl.trim() }),
      });
      const data = await response.json() as { success?: boolean; product?: ImportedProduct; message?: string };
      if (!response.ok || !data.success || !data.product) throw new Error(data.message || "상품 정보 불러오기 실패");
      const product = data.product;
      setAffiliateUrl(product.finalUrl || affiliateUrl.trim());
      setProductName(product.name || "");
      setProductDescription(product.description || "");
      setProductImageUrl(product.imageUrl || "");
      setImageLoadFailed(false);
      setPriceText(product.priceText
        ? product.discountText
          ? `${product.priceText} · ${product.discountText} 할인`
          : product.priceText
        : "");
      setPlatform(product.platform || "");
      const keyword = product.name ? localChineseKeyword(product.name) : "";
      setChineseKeyword(keyword);
      const imageStatus = product.imageStored
        ? "대표 이미지도 GY 저장소에 복사했습니다."
        : product.imageUrl
          ? "대표 이미지는 외부 주소로 확인했습니다. 화면에서 깨지면 직접 업로드해주세요."
          : "대표 이미지를 찾지 못했습니다. 직접 업로드 또는 AI 이미지 생성으로 보완해주세요.";
      setStatus(product.warning || `상품 정보를 불러왔습니다. ${imageStatus} 중국 검색어 ${keyword}도 준비했습니다.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "상품 정보 불러오기 실패");
    } finally {
      setBusy("");
    }
  }

  async function uploadProductImage(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("상품 이미지는 JPG, PNG, WEBP 형식만 사용할 수 있습니다.");
      return;
    }
    if (file.size < 1 || file.size > 8 * 1024 * 1024) {
      setError("상품 이미지는 8MB 이하여야 합니다.");
      return;
    }
    setBusy("product-image-upload");
    setError("");
    setStatus("상품 이미지를 GY 저장소에 업로드하고 있습니다.");
    try {
      const form = new FormData();
      form.append("images", file);
      const response = await fetch("/api/creative-studio-pro/references", { method: "POST", body: form });
      const data = await response.json() as { success?: boolean; urls?: string[]; message?: string };
      if (!response.ok || !data.success || !data.urls?.[0]) throw new Error(data.message || "상품 이미지 업로드 실패");
      setProductImageUrl(data.urls[0]);
      setImageLoadFailed(false);
      setStatus("상품 이미지를 GY 저장소에 안전하게 저장했습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "상품 이미지 업로드 실패");
    } finally {
      setBusy("");
    }
  }
  async function prepareChineseSearch() {
    const base = productName.trim();
    if (!base) {
      setError("상품명 또는 제휴링크 자동 불러오기를 먼저 완료해주세요.");
      return;
    }
    setBusy("translate");
    setError("");
    try {
      const response = await fetch("/api/china-video-lab/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: base }),
      });
      const data = await response.json() as { success?: boolean; translatedProductName?: string; message?: string; warning?: string };
      if (!response.ok || !data.success || !data.translatedProductName) throw new Error(data.message || "AI 번역 실패");
      setChineseKeyword(data.translatedProductName);
      setStatus(data.warning || `중국어 검색어 ${data.translatedProductName}를 준비했습니다.`);
    } catch (cause) {
      const fallback = localChineseKeyword(base);
      setChineseKeyword(fallback);
      setStatus(`AI 번역 불가 → 내장 사전으로 ${fallback} 검색을 준비했습니다. ${cause instanceof Error ? cause.message : ""}`.trim());
    } finally {
      setBusy("");
    }
  }

  async function publicSearch() {
    const query = chineseKeyword.trim() || localChineseKeyword(productName);
    if (!query) return;
    setBusy("public-search");
    setError("");
    setStatus("도우인·샤오홍슈 공개 영상 카드를 찾고 있습니다.");
    try {
      const response = await fetch("/api/china-video-lab/public-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: productName || query,
          translatedProductName: query,
          keywords: [{ simplifiedChinese: query, koreanMeaning: productName, intent: "product" }],
          platform: "all",
          limit: 16,
        }),
      });
      const data = await response.json() as { results?: SearchResult[]; message?: string };
      const results = Array.isArray(data.results) ? data.results : [];
      setSearchResults((current) => Array.from(new Map([...results, ...current].map((item) => [item.url, item])).values()));
      setStatus(results.length ? `영상 후보 ${results.length}개를 찾았습니다. 사이트에서 재생해보고 2~3개를 고르세요.` : "공개 결과가 없습니다. Edge 로그인 검색을 사용하세요.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "중국 영상 검색 실패");
    } finally {
      setBusy("");
    }
  }

  function edgeSearch() {
    const query = chineseKeyword.trim() || localChineseKeyword(productName);
    window.postMessage({
      source: APP_SOURCE,
      type: "GY_CHINA_CONNECTOR_SEARCH",
      requestId: window.crypto.randomUUID(),
      query,
      platform: "all",
      limit: 20,
    }, window.location.origin);
    setStatus("Edge 로그인 검색을 시작했습니다. 열린 도우인·샤오홍슈 화면에서 로그인 확인을 완료해주세요.");
  }

  async function previewResult(item: SearchResult) {
    setPreview({ item, loading: true, mode: "platform-player", playbackUrl: "", message: "영상 재생 방식을 확인하고 있습니다." });
    if (item.directVideoUrl?.startsWith("https://")) {
      setPreview({ item, loading: false, mode: "direct-video", playbackUrl: item.directVideoUrl, message: "사이트 안에서 영상을 재생합니다." });
      return;
    }
    try {
      const response = await fetch("/api/creative-studio-pro/china-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url }),
      });
      const data = await response.json() as { success?: boolean; mode?: string; embedUrl?: string; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message || "영상 미리보기 실패");
      setPreview({
        item,
        loading: false,
        mode: data.mode === "official-embed" ? "official-embed" : "platform-player",
        playbackUrl: String(data.embedUrl || ""),
        message: String(data.message || "원문 플레이어에서 확인하세요."),
      });
    } catch (cause) {
      setPreview({ item, loading: false, mode: "error", playbackUrl: "", message: cause instanceof Error ? cause.message : "영상 미리보기 실패" });
    }
  }

  function toggleSelected(item: SearchResult) {
    setSelectedIds((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
      if (current.length >= 3) {
        setError("AI 짜집기 영상은 최대 3개까지 선택할 수 있습니다.");
        return current;
      }
      setError("");
      return [...current, item.id];
    });
    setCuts([]);
    setMixSummary("");
  }

  async function connectSourceFile(resultId: string, file: File | undefined, rightsStatus: LinkedSource["rightsStatus"]) {
    if (!file) return;
    if (!selectedIds.includes(resultId)) {
      setError("먼저 이 영상을 선택해주세요.");
      return;
    }
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      setError("MP4, WEBM, MOV 영상만 연결할 수 있습니다.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError("영상 파일은 500MB 이하여야 합니다.");
      return;
    }
    setBusy(`source-${resultId}`);
    try {
      const duration = await videoDuration(file);
      setSources((current) => {
        const previous = current.find((source) => source.resultId === resultId);
        if (previous) URL.revokeObjectURL(previous.previewUrl);
        const next = current.filter((source) => source.resultId !== resultId);
        return [...next, {
          id: uid("source"),
          resultId,
          title: file.name.replace(/\.[^.]+$/, ""),
          file,
          previewUrl: URL.createObjectURL(file),
          duration,
          trimStart: 0,
          trimEnd: duration,
          rightsStatus,
        }];
      });
      setCuts([]);
      setStatus("선택 영상에 사용 허가 파일을 연결했습니다.");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "영상 파일 연결 실패");
    } finally {
      setBusy("");
    }
  }

  async function requestAiMix() {
    if (selectedResults.length < 2 || selectedResults.length > 3) {
      setError("먼저 영상 2~3개를 선택해주세요.");
      return;
    }
    const linked = selectedResults.map((result) => sources.find((source) => source.resultId === result.id)).filter((source): source is LinkedSource => Boolean(source));
    if (linked.length !== selectedResults.length) {
      setError("선택한 각 영상에 사용 허가 MP4·MOV 파일을 연결해주세요.");
      return;
    }
    setBusy("ai-mix");
    setError("");
    setStatus("선택한 2~3개 영상의 장면과 인기 신호를 비교해 새로운 판매 순서를 만들고 있습니다.");
    try {
      const response = await fetch("/api/revenue-shorts/ai-remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          productDescription,
          targetDuration,
          mode: "conversion-first",
          popularFirst: true,
          instruction: "첫 2초 훅을 강하게 만들고, 서로 다른 영상의 사용 장면과 디테일을 교차 편집한 뒤 짧은 CTA로 끝낸다.",
          keywordSignals: [{ keyword: chineseKeyword, koreanMeaning: productName, intent: "product", score: 95, evidenceCount: selectedResults.length, selected: true }],
          selectedVideos: selectedResults.map((result) => ({
            id: result.id,
            platform: result.platform,
            title: result.title,
            url: result.url,
            thumbnailUrl: result.thumbnailUrl || "",
            popularityScore: popularityScore(result),
            popularityLabel: result.popularityLabel || "",
            nativeRank: result.nativeRank || null,
            engagement: result.engagement || {},
            linkedSourceId: linked.find((source) => source.resultId === result.id)?.id || "",
          })),
          sources: linked.map((source) => ({
            id: source.id,
            title: source.title,
            duration: source.duration,
            trimStart: source.trimStart,
            trimEnd: source.trimEnd,
            referenceResultId: source.resultId,
          })),
          currentCuts: cuts,
        }),
      });
      const data = await response.json() as { success?: boolean; cuts?: Array<Record<string, unknown>>; summary?: string; engine?: string; warning?: string; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message || "AI 짜집기 실패");
      const nextCuts = (Array.isArray(data.cuts) ? data.cuts : []).map((cut, index): RemixCut => ({
        id: uid(`cut-${index}`),
        order: index + 1,
        sourceId: String(cut.sourceId || linked[index % linked.length]?.id || ""),
        sourceStartSecond: Math.max(0, Number(cut.sourceStartSecond) || 0),
        durationSeconds: clamp(Number(cut.durationSeconds) || 1.5, .7, 2.5),
        role: String(cut.role || "demo"),
        priorityKeyword: String(cut.priorityKeyword || chineseKeyword),
        subtitleIntent: String(cut.subtitleIntent || "실제 사용 장면으로 확인하세요."),
        direction: String(cut.direction || "선택한 영상의 장면을 교차 편집"),
        reason: String(cut.reason || "대표님이 선택한 영상 기준"),
        referenceVideoId: String(cut.referenceVideoId || selectedResults[index % selectedResults.length]?.id || ""),
      }));
      const finalCuts = nextCuts.length ? nextCuts : buildFallbackCuts(linked, selectedResults, targetDuration);
      setCuts(finalCuts);
      setMixSummary(String(data.summary || `${data.engine === "ai" ? "AI" : "무료 엔진"}이 ${finalCuts.length}컷을 만들었습니다.`));
      setStatus(data.warning ? `AI 응답 불안정 → 무료 보완 엔진으로 완성했습니다. ${data.warning}` : "선택 영상 2~3개 기반 AI 짜집기가 완료됐습니다. 아래에서 실제 영상을 재생하세요.");
      setPreviewCutIndex(0);
    } catch (cause) {
      const fallback = buildFallbackCuts(linked, selectedResults, targetDuration);
      setCuts(fallback);
      setMixSummary(`AI 사용 불가 → 무료 자동 편집으로 ${fallback.length}컷을 구성했습니다.`);
      setStatus(`AI 사용 불가 → 무료 자동 짜집기로 계속했습니다. ${cause instanceof Error ? cause.message : ""}`.trim());
    } finally {
      setBusy("");
    }
  }

  function moveCut(index: number, direction: -1 | 1) {
    setCuts((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((cut, position) => ({ ...cut, order: position + 1 }));
    });
  }

  function startMixPreview() {
    if (!cuts.length) {
      setError("먼저 AI 짜집기를 실행해주세요.");
      return;
    }
    setPreviewCutIndex(0);
    setPreviewPlaying(true);
    setError("");
  }

  async function uploadReferenceFrame(frame: File) {
    const form = new FormData();
    form.append("images", frame);
    const response = await fetch("/api/creative-studio-pro/references", { method: "POST", body: form });
    const data = await response.json() as { success?: boolean; urls?: string[]; message?: string };
    if (!response.ok || !data.success || !data.urls?.[0]) throw new Error(data.message || "대표 이미지 업로드 실패");
    return data.urls[0];
  }

  async function uploadVideoFile(file: File) {
    const ticketResponse = await fetch("/api/creative-studio-pro/reference-videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
    });
    const ticket = await ticketResponse.json() as { success?: boolean; bucket?: string; path?: string; token?: string; publicUrl?: string; message?: string };
    if (!ticketResponse.ok || !ticket.success || !ticket.bucket || !ticket.path || !ticket.token || !ticket.publicUrl) {
      throw new Error(ticket.message || "영상 업로드 준비 실패");
    }
    const supabase = createBrowserSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from(ticket.bucket)
      .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`영상 업로드 실패: ${uploadError.message}`);
    return ticket.publicUrl;
  }

  async function pollRender(projectId: string) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 1000 : 4000));
      const response = await fetch(`/api/creative-studio-pro/projects/${projectId}`, { cache: "no-store" });
      const data = await response.json() as { success?: boolean; project?: { final_video_url?: string }; renderJob?: { status?: string; error_message?: string } };
      if (!response.ok || !data.success) continue;
      if (data.project?.final_video_url) {
        setRender({ projectId, status: "완성", finalVideoUrl: data.project.final_video_url });
        setStatus("최종 MP4가 완성되었습니다.");
        return;
      }
      if (data.renderJob?.status === "failed") throw new Error(data.renderJob.error_message || "FFmpeg 렌더링 실패");
      setRender((current) => ({ ...current, projectId, status: data.renderJob?.status === "rendering" ? "FFmpeg 합성 중" : "렌더링 대기 중" }));
    }
    throw new Error("렌더링 시간이 길어졌습니다. 프로젝트 이력에서 상태를 확인해주세요.");
  }

  async function renderFinalMp4() {
    if (selectedResults.length < 2 || !cuts.length) {
      setError("영상 2~3개 선택과 AI 짜집기를 먼저 완료해주세요.");
      return;
    }
    const linked = selectedResults.map((result) => sources.find((source) => source.resultId === result.id)).filter((source): source is LinkedSource => Boolean(source));
    if (linked.length !== selectedResults.length) {
      setError("선택한 영상 파일 연결을 다시 확인해주세요.");
      return;
    }
    setBusy("render");
    setError("");
    setRender({ projectId: "", status: "대표 프레임 준비", finalVideoUrl: "" });
    try {
      const frame = await frameFileFromVideo(linked[0].file, .5);
      const frameUrl = await uploadReferenceFrame(frame);

      setRender((current) => ({ ...current, status: "프로젝트 생성" }));
      const projectResponse = await fetch("/api/creative-studio-pro/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${productName || "상품"} AI 짜집기 쇼츠`,
          productName: productName || "상품",
          productDescription,
          productUrl: affiliateUrl,
          affiliateUrl,
          masterPrompt: "대표님이 직접 선택한 2~3개 사용 허가 영상만 사용해 새로운 한국형 판매 순서로 편집한다.",
          sourceMode: "single-photo-commerce",
          sourceImageUrl: frameUrl,
          referenceImageUrls: [frameUrl],
          duration: targetDuration,
          ratio: "720:1280",
          style: "problem-solution",
          subtitleMode: "korean",
          voiceMode: "none",
          voicePreset: "marin",
          musicMood: "none",
          subtitleStyle: "bold-pop",
          thumbnailStyle: "benefit-arrow",
          sfxMode: "none",
          platformTargets: ["youtube", "instagram"],
          qualityThreshold: 85,
          maxImageRetries: 1,
        }),
      });
      const created = await projectResponse.json() as { success?: boolean; project?: { id?: string }; message?: string };
      if (!projectResponse.ok || !created.success || !created.project?.id) throw new Error(created.message || "프로젝트 생성 실패");
      const projectId = created.project.id;
      setRender({ projectId, status: "영상 업로드", finalVideoUrl: "" });

      const uploaded = [] as Array<{ source: LinkedSource; url: string; id: string }>;
      for (const [index, source] of linked.entries()) {
        const url = await uploadVideoFile(source.file);
        uploaded.push({ source, url, id: `command-source-${Date.now()}-${index}` });
      }
      const sourceIdMap = new Map(uploaded.map(({ source, id }) => [source.id, id]));
      const sourceMap = new Map(linked.map((source) => [source.id, source]));
      let timeline = 0;
      const renderCuts = cuts.map((cut, index) => {
        const source = sourceMap.get(cut.sourceId);
        const referenceId = sourceIdMap.get(cut.sourceId);
        if (!source || !referenceId) throw new Error(`컷 ${index + 1}의 연결 영상을 찾지 못했습니다.`);
        const durationSeconds = clamp(cut.durationSeconds, .7, 2.5);
        const sourceStartSecond = clamp(cut.sourceStartSecond, source.trimStart, Math.max(source.trimStart, source.trimEnd - .7));
        const row = {
          order: index + 1,
          startSecond: Number(timeline.toFixed(2)),
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
        timeline += durationSeconds;
        return row;
      });
      const mediaReferences = uploaded.map(({ source, url, id }) => ({
        id,
        platform: selectedResults.find((result) => result.id === source.resultId)?.platform || "owned",
        url,
        title: source.title,
        assetKind: "video-file",
        rightsStatus: source.rightsStatus,
        useInFinal: true,
        includeInMixAnalysis: true,
        notes: "GY 통합 제작실에서 대표님이 선택한 중국 인기영상과 연결한 사용 허가 파일",
        analysisFrameUrls: [],
        selectedKeywords: [chineseKeyword].filter(Boolean),
        durationSeconds: source.duration,
        trimStartSecond: source.trimStart,
        trimEndSecond: source.trimEnd,
        createdAt: new Date().toISOString(),
      }));
      const disclosure = "이 콘텐츠는 제휴 활동의 일환으로 일정액의 수수료를 제공받을 수 있습니다.";
      const commercePackage = {
        productCode: `GY-${Date.now()}`,
        title: `${productName} 실제 사용 쇼츠`,
        hookOptions: cuts.slice(0, 3).map((cut) => cut.subtitleIntent),
        voiceover: cuts.map((cut) => cut.subtitleIntent).join(" "),
        description: `${productDescription}\n\n${affiliateUrl}\n${disclosure}`.trim(),
        hashtags: ["#쇼핑쇼츠", "#상품추천", "#GYLabs"],
        disclosure,
        cta: affiliateUrl ? "상품 링크에서 자세히 확인하세요." : "상품 정보를 확인하세요.",
        thumbnailOptions: [{ headline: `${productName}, 직접 보세요`, accent: "실사용", layout: "benefit-arrow" }],
        verifiedClaims: [productDescription].filter(Boolean),
        cautions: ["과장 표현 없이 실제 확인 가능한 정보만 사용"],
        subtitleCues: renderCuts.map((cut, index) => ({
          index: index + 1,
          startSecond: cut.startSecond,
          endSecond: cut.startSecond + cut.durationSeconds,
          text: cut.subtitleIntent,
        })),
        platformVersions: {
          youtube: { title: `${productName} 실제 사용 쇼츠`, description: `${productDescription}\n${affiliateUrl}\n${disclosure}`, script: cuts.map((cut) => cut.subtitleIntent).join(" "), hashtags: ["#쇼핑쇼츠", "#상품추천"] },
          instagram: { caption: `${productName} 실제 사용 장면\n${disclosure}`, script: cuts.map((cut) => cut.subtitleIntent).join(" "), hashtags: ["#릴스", "#상품추천"] },
        },
      };

      setRender({ projectId, status: "컷 계획 저장", finalVideoUrl: "" });
      const planResponse = await fetch(`/api/revenue-shorts/projects/${projectId}/manual-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaReferences,
          cuts: renderCuts,
          commercePackage,
          durationSeconds: targetDuration,
          voiceAudioUrl: "",
          customMusicUrl: "",
          musicVolume: .1,
          subtitleStyle: "bold-pop",
          subtitleCleanupMode: "safe-bottom-crop",
          playbackSpeed: 1,
        }),
      });
      const plan = await planResponse.json() as { success?: boolean; message?: string };
      if (!planResponse.ok || !plan.success) throw new Error(plan.message || "렌더 계획 저장 실패");

      setRender({ projectId, status: "Render Worker 요청", finalVideoUrl: "" });
      const renderResponse = await fetch(`/api/creative-studio-pro/projects/${projectId}/render`, { method: "POST" });
      const renderData = await renderResponse.json() as { success?: boolean; message?: string };
      if (!renderResponse.ok || !renderData.success) throw new Error(renderData.message || "최종 MP4 렌더링 요청 실패");
      await pollRender(projectId);
    } catch (cause) {
      setRender((current) => ({ ...current, status: "실패" }));
      setError(cause instanceof Error ? cause.message : "최종 MP4 생성 실패");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <span>GY SALES VIDEO COMMAND CENTER · LIVE WORKFLOW</span>
          <h1>제휴링크 하나에서 영상 선택·AI 짜집기·MP4까지</h1>
          <p>도우인·샤오홍슈 영상을 직접 확인하고, 마음에 드는 2~3개만 골라 새로운 한국형 판매 영상으로 재구성합니다.</p>
        </div>
        <div className={styles.version}>V4 · 실제 영상 중심</div>
      </header>

      <div className={styles.progress}>
        <span className={affiliateUrl || productName ? styles.done : styles.active}>1 상품 자동수집</span>
        <span className={searchResults.length ? styles.done : affiliateUrl || productName ? styles.active : ""}>2 영상 시청·선택</span>
        <span className={cuts.length ? styles.done : selectedIds.length >= 2 ? styles.active : ""}>3 AI 짜집기</span>
        <span className={render.finalVideoUrl ? styles.done : cuts.length ? styles.active : ""}>4 최종 MP4</span>
      </div>

      {(status || error) && (
        <div className={error ? styles.alertError : styles.alertSuccess}>
          <strong>{error ? "확인 필요" : "진행 상태"}</strong>
          <span>{error || status}</span>
        </div>
      )}

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <div><span>STEP 01</span><h2>제휴링크에서 상품 정보를 자동으로 가져옵니다</h2><p>등록된 GY 상품을 먼저 찾고, 없으면 공개 상품 페이지의 구조화 데이터·제목·설명·이미지·가격을 읽습니다.</p></div>
          <b>자동 입력 후 직접 수정 가능</b>
        </div>
        <div className={styles.importRow}>
          <input value={affiliateUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => setAffiliateUrl(event.target.value)} placeholder="쿠팡·Temu·네이버·기타 제휴링크 붙여넣기" />
          <button onClick={() => void importProduct()} disabled={busy === "product-import"}>{busy === "product-import" ? "상품 확인 중..." : "상품 정보 자동 불러오기"}</button>
        </div>
        <div className={styles.productGrid}>
          <div className={styles.productPreview}>
            <div className={styles.productPreviewMedia}>
              {productImageUrl && !imageLoadFailed
                ? <img src={productImageUrl} alt={productName || "상품 이미지"} onError={() => { setImageLoadFailed(true); setStatus("외부 상품 이미지 표시가 차단됐습니다. 아래 직접 업로드를 사용해주세요."); }} />
                : <div><strong>상품 이미지</strong><span>{productImageUrl ? "외부 이미지 표시 실패" : "제휴링크에서 자동 수집"}</span></div>}
            </div>
            <div className={styles.imageFallbackActions}>
              <label className={styles.imageUploadButton}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadProductImage(event.target.files?.[0])} />
                <span>{busy === "product-image-upload" ? "이미지 저장 중..." : "상품 이미지 직접 업로드"}</span>
              </label>
              <a href="/admin/creative-studio-pro" target="_blank" rel="noreferrer">AI 상품 이미지 만들기</a>
            </div>
          </div>
          <div className={styles.productFields}>
            <label><span>상품명</span><input value={productName} onChange={(event: ChangeEvent<HTMLInputElement>) => setProductName(event.target.value)} placeholder="상품명" /></label>
            <label><span>가격·할인</span><input value={priceText} onChange={(event: ChangeEvent<HTMLInputElement>) => setPriceText(event.target.value)} placeholder="자동 확인 또는 직접 입력" /></label>
            <label className={styles.wide}><span>상품 설명·판매 포인트</span><textarea value={productDescription} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setProductDescription(event.target.value)} placeholder="상품 설명과 실제 장점" /></label>
            <label className={styles.wide}><span>상품 이미지 주소</span><input value={productImageUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => { setProductImageUrl(event.target.value); setImageLoadFailed(false); }} placeholder="자동 저장된 Supabase 이미지 주소 또는 직접 입력" /></label>
            <label><span>판매 플랫폼</span><input value={platform} onChange={(event: ChangeEvent<HTMLInputElement>) => setPlatform(event.target.value)} placeholder="coupang / temu / naver" /></label>
            <label><span>중국어 검색어</span><input value={chineseKeyword} onChange={(event: ChangeEvent<HTMLInputElement>) => setChineseKeyword(event.target.value)} placeholder="예: 手持小风扇" /></label>
          </div>
        </div>
        <div className={styles.actionRow}>
          <button className={styles.secondary} onClick={() => void prepareChineseSearch()} disabled={busy === "translate"}>{busy === "translate" ? "검색어 준비 중..." : "중국 검색어 자동 준비"}</button>
          <button className={styles.primary} onClick={() => void publicSearch()} disabled={busy === "public-search"}>{busy === "public-search" ? "영상 찾는 중..." : "도우인·샤오홍슈 영상 찾기"}</button>
          <button className={styles.secondary} onClick={edgeSearch}>Edge 로그인 인기영상 검색</button>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <div><span>STEP 02 · SOURCE THEATER</span><h2>사이트 안에서 영상을 보고 2~3개를 고릅니다</h2><p>왼쪽 큰 화면에서 재생하고, 오른쪽 후보 목록에서 선택합니다. 선택한 영상만 AI 짜집기에 들어갑니다.</p></div>
          <b>{selectedIds.length}/3 선택</b>
        </div>
        <div className={styles.theater}>
          <div className={styles.stage}>
            {preview ? (
              <>
                <div className={styles.player}>
                  {preview.loading ? <div className={styles.emptyPlayer}><strong>영상 불러오는 중</strong><span>{preview.item.title}</span></div>
                    : preview.mode === "direct-video" ? <video src={preview.playbackUrl} controls autoPlay muted playsInline />
                      : preview.mode === "official-embed" ? <iframe src={preview.playbackUrl} title={preview.item.title} allow="autoplay; fullscreen" />
                        : <div className={styles.fallbackPlayer}>{preview.item.thumbnailUrl ? <img src={preview.item.thumbnailUrl} alt="" /> : <strong>{preview.item.platform === "douyin" ? "抖音" : "小红书"}</strong>}<div><span>{preview.message}</span><a href={preview.item.url} target="_blank" rel="noreferrer">로그인된 원문 플레이어에서 재생</a></div></div>}
                </div>
                <div className={styles.stageMeta}>
                  <div><small>{preview.item.platform} · 인기 신호 {popularityScore(preview.item)}점</small><strong>{preview.item.title}</strong><p>{preview.message}</p></div>
                  <button className={selectedIds.includes(preview.item.id) ? styles.selectedButton : styles.selectButton} onClick={() => toggleSelected(preview.item)}>{selectedIds.includes(preview.item.id) ? "선택됨 ✓" : "이 영상 선택"}</button>
                </div>
              </>
            ) : <div className={styles.emptyPlayer}><span>GY SOURCE THEATER</span><strong>후보 영상의 ‘여기서 보기’를 눌러주세요</strong><p>도우인 공식 임베드 또는 Edge 로그인 검색 결과의 재생 주소를 사용합니다.</p></div>}
          </div>
          <aside className={styles.queue}>
            <div className={styles.queueHead}><strong>영상 후보</strong><span>{rankedResults.length}개</span></div>
            <div className={styles.queueList}>
              {rankedResults.length ? rankedResults.map((item, index) => {
                const selected = selectedIds.includes(item.id);
                return <article className={selected ? `${styles.queueCard} ${styles.queueSelected}` : styles.queueCard} key={item.url}>
                  <button className={styles.thumb} onClick={() => void previewResult(item)}>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <span>{item.platform === "douyin" ? "抖音" : "小红书"}</span>}</button>
                  <div><small>우선 {index + 1} · {popularityScore(item)}점</small><strong>{item.title}</strong><p>♥ {formatMetric(item.engagement?.likes)} · 저장 {formatMetric(item.engagement?.saves)}</p><div><button onClick={() => void previewResult(item)}>여기서 보기</button><button onClick={() => toggleSelected(item)}>{selected ? "선택 해제" : "선택"}</button></div></div>
                </article>;
              }) : <div className={styles.queueEmpty}>상품 정보를 입력하고 중국 영상을 검색하세요.</div>}
            </div>
          </aside>
        </div>

        {selectedResults.length > 0 && <div className={styles.selectionTray}>
          <div className={styles.selectionTitle}><span>SELECTED FOR AI MIX</span><h3>선택한 영상 {selectedResults.length}개</h3><p>각 영상과 대응되는 직접 촬영·판매자 제공·제휴 제공·사용 허가 MP4·MOV 파일을 연결하세요.</p></div>
          <div className={styles.selectedFiles}>{selectedResults.map((item, index) => {
            const source = sources.find((row) => row.resultId === item.id);
            return <article key={item.id}>
              <div>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <span>{index + 1}</span>}</div>
              <section><small>{index + 1}번째 선택</small><strong>{item.title}</strong><p>{source ? `${source.title} · ${source.duration.toFixed(1)}초 연결됨` : "아직 실제 영상 파일이 연결되지 않았습니다."}</p></section>
              <label><select defaultValue="affiliate-provided" id={`rights-${item.id}`}><option value="owned">직접 촬영</option><option value="seller-provided">판매자 제공</option><option value="affiliate-provided">제휴 제공</option><option value="permission-confirmed">사용 허가 확인</option></select><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event: ChangeEvent<HTMLInputElement>) => { const select = document.getElementById(`rights-${item.id}`) as HTMLSelectElement | null; void connectSourceFile(item.id, event.target.files?.[0], (select?.value || "affiliate-provided") as LinkedSource["rightsStatus"]); }} /><span>{busy === `source-${item.id}` ? "파일 확인 중..." : source ? "다른 파일로 교체" : "사용 허가 영상 연결"}</span></label>
            </article>;
          })}</div>
          <button className={styles.mixButton} onClick={() => void requestAiMix()} disabled={busy === "ai-mix" || selectedResults.length < 2}>{busy === "ai-mix" ? "AI가 장면을 분석하고 있습니다..." : "선택한 2~3개로 AI 짜집기"}</button>
        </div>}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <div><span>STEP 03 · AI MIX PREVIEW</span><h2>짜집기 결과를 실제 영상으로 재생합니다</h2><p>AI가 만든 컷 순서대로 연결 영상을 자동으로 넘겨 재생합니다. 순서가 마음에 들지 않으면 컷을 위·아래로 이동하세요.</p></div>
          <b>{cuts.length}컷 · {cuts.reduce((sum, cut) => sum + cut.durationSeconds, 0).toFixed(1)}초</b>
        </div>
        <div className={styles.mixPreviewGrid}>
          <div className={styles.mixPlayer}>
            <video ref={mixVideoRef} controls muted playsInline />
            {currentPreviewCut && <div className={styles.subtitleOverlay}><small>{currentPreviewCut.role.toUpperCase()}</small><strong>{currentPreviewCut.subtitleIntent}</strong></div>}
            <div className={styles.previewControls}><button onClick={startMixPreview} disabled={!cuts.length}>{previewPlaying ? "짜집기 재생 중..." : "AI 짜집기 실제 재생"}</button><span>{cuts.length ? `${previewCutIndex + 1}/${cuts.length}컷` : "AI 짜집기 전"}</span></div>
          </div>
          <div className={styles.timeline}>
            {mixSummary && <div className={styles.mixSummary}>{mixSummary}</div>}
            {cuts.length ? cuts.map((cut, index) => {
              const source = sources.find((row) => row.id === cut.sourceId);
              return <article className={index === previewCutIndex && previewPlaying ? styles.activeCut : ""} key={cut.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{cut.role} · {source?.title || "연결 영상"}</strong><p>{cut.subtitleIntent}</p><small>원본 {cut.sourceStartSecond.toFixed(1)}초부터 {cut.durationSeconds.toFixed(1)}초 · {cut.reason}</small></div><aside><button onClick={() => moveCut(index, -1)}>↑</button><button onClick={() => moveCut(index, 1)}>↓</button></aside></article>;
            }) : <div className={styles.timelineEmpty}>STEP 02에서 영상 2~3개를 선택하고 AI 짜집기를 실행하세요.</div>}
          </div>
        </div>
        <div className={styles.renderBar}>
          <div><span>FINAL OUTPUT</span><strong>{render.status || "Render Worker 대기"}</strong>{render.projectId && <small>프로젝트 {render.projectId}</small>}</div>
          <button onClick={() => void renderFinalMp4()} disabled={busy === "render" || !cuts.length}>{busy === "render" ? "MP4 합성 중..." : "이 짜집기로 최종 MP4 만들기"}</button>
        </div>
        {render.finalVideoUrl && <div className={styles.finalVideo}><video src={render.finalVideoUrl} controls playsInline /><div><span>FINAL SALES VIDEO</span><h3>최종 MP4 완성</h3><p>사이트 안에서 확인한 뒤 다운로드하거나 공개 영상 전시장에 연결할 수 있습니다.</p><a href={render.finalVideoUrl} target="_blank" rel="noreferrer" download>완성 MP4 열기·다운로드</a></div></div>}
      </section>
    </div>
  );
}
