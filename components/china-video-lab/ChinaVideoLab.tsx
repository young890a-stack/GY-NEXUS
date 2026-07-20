"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ChinaVideoLab.module.css";

type Platform = "all" | "douyin" | "xiaohongshu";
type SourceMode = "public-index" | "browser-account";

type SearchResult = {
  id: string;
  platform: "douyin" | "xiaohongshu";
  title: string;
  url: string;
  thumbnailUrl: string;
  durationSeconds: number | null;
  engagement: {
    likes: number | null;
    comments: number | null;
    saves: number | null;
  };
  popularityLabel: string;
  note: string;
  rightsStatus: "unverified";
  canUseOriginal: false;
  sourceLabel: string;
  sourceMode?: SourceMode;
  nativeRank?: number;
  hashtags?: string[];
};

type Keyword = {
  simplifiedChinese: string;
  koreanMeaning: string;
  intent: "product" | "problem" | "use-case" | "review" | "viral";
  evidenceCount?: number;
  trendScore?: number;
  trendLabel?: string;
};

type Project = {
  id: string;
  title: string;
  product_name: string;
  duration_seconds: number;
  status: string;
};

type HealthService = {
  configured: boolean;
  label: string;
};

type HealthPayload = {
  success: boolean;
  services?: Record<string, HealthService>;
};

type StateName = "checking" | "ready" | "searching" | "warning" | "error" | "idle";

const CONNECTOR_SOURCE = "GY_CHINA_CONNECTOR";
const APP_SOURCE = "GY_NEXUS";

function uniqueResults(items: SearchResult[]) {
  return Array.from(
    new Map(
      items
        .filter((item) => item?.url && item?.platform)
        .map((item) => [item.url, item]),
    ).values(),
  ).slice(0, 24);
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      response.ok
        ? "서버 응답 형식을 읽지 못했습니다."
        : `서버가 JSON 대신 다른 화면을 반환했습니다. HTTP ${response.status}`,
    );
  }
}

async function requestJson(
  url: string,
  init: RequestInit = {},
  timeoutMilliseconds = 45000,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await readJson(response);
    if (!response.ok || data.success === false) {
      throw new Error(String(data.message || `요청 실패 · HTTP ${response.status}`));
    }
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("응답 시간이 너무 오래 걸렸습니다. 연결 상태를 확인하고 다시 시도해주세요.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function stateClass(state: StateName) {
  if (state === "ready") return styles.good;
  if (state === "warning") return styles.warn;
  if (state === "error") return styles.bad;
  if (state === "searching" || state === "checking") return styles.work;
  return styles.idle;
}

function stateText(state: StateName) {
  if (state === "ready") return "정상";
  if (state === "warning") return "확인 필요";
  if (state === "error") return "오류";
  if (state === "searching") return "검색 중";
  if (state === "checking") return "확인 중";
  return "대기";
}

export default function ChinaVideoLab() {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Platform>("all");
  const [translatedName, setTranslatedName] = useState("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [health, setHealth] = useState<HealthPayload | null>(null);

  const [translationState, setTranslationState] = useState<StateName>("idle");
  const [publicState, setPublicState] = useState<StateName>("idle");
  const [connectorState, setConnectorState] = useState<StateName>("checking");
  const [douyinState, setDouyinState] = useState<StateName>("idle");
  const [xiaohongshuState, setXiaohongshuState] = useState<StateName>("idle");

  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState("상품명을 입력하면 AI 번역과 Edge 로그인 검색을 서로 독립적으로 실행합니다.");
  const [error, setError] = useState("");
  const connectorTimer = useRef<number | null>(null);
  const connectorRequestId = useRef("");

  const selectedResults = useMemo(
    () => results.filter((item) => selectedIds.includes(item.id)),
    [results, selectedIds],
  );
  const activeKeyword = translatedName || query.trim();
  const selectedProject = projects.find((item) => item.id === projectId);

  useEffect(() => {
    void requestJson("/api/china-video-lab/health", {}, 12000)
      .then((data) => setHealth(data as HealthPayload))
      .catch((cause) => {
        setHealth({ success: false });
        setError(cause instanceof Error ? cause.message : "시스템 상태 확인 실패");
      });

    void requestJson("/api/creative-studio-pro/projects", {}, 15000)
      .then((data) => {
        const loaded = Array.isArray(data.projects) ? data.projects as Project[] : [];
        setProjects(loaded);
        if (loaded[0]) setProjectId(loaded[0].id);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "프로젝트 목록을 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    function onConnectorMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== CONNECTOR_SOURCE) return;

      if (event.data.type === "GY_CHINA_CONNECTOR_PONG") {
        setConnectorState("ready");
        return;
      }

      if (event.data.type !== "GY_CHINA_CONNECTOR_RESULTS") return;
      if (
        connectorRequestId.current
        && event.data.requestId
        && event.data.requestId !== connectorRequestId.current
      ) return;

      if (connectorTimer.current) {
        window.clearTimeout(connectorTimer.current);
        connectorTimer.current = null;
      }

      const nativeResults = Array.isArray(event.data.results)
        ? event.data.results as SearchResult[]
        : [];

      if (event.data.success) {
        setConnectorState("ready");
        setResults((current) => uniqueResults([...nativeResults, ...current]));
        setSelectedIds([]);

        const hasDouyin = nativeResults.some((item) => item.platform === "douyin");
        const hasXiaohongshu = nativeResults.some((item) => item.platform === "xiaohongshu");

        if (platform !== "xiaohongshu") setDouyinState(hasDouyin ? "ready" : "warning");
        if (platform !== "douyin") setXiaohongshuState(hasXiaohongshu ? "ready" : "warning");

        setNotice(
          nativeResults.length
            ? `Edge 로그인 화면에서 영상 카드 ${nativeResults.length}개를 가져왔습니다.`
            : String(event.data.message || "로그인 검색 화면에서 영상 카드가 확인되지 않았습니다."),
        );
      } else {
        setConnectorState("error");
        setNotice(String(event.data.message || "Edge 로그인 검색이 응답하지 않았습니다."));
      }
    }

    window.addEventListener("message", onConnectorMessage);
    window.postMessage(
      { source: APP_SOURCE, type: "GY_CHINA_CONNECTOR_PING" },
      window.location.origin,
    );

    const pingTimer = window.setTimeout(() => {
      setConnectorState((current) => current === "checking" ? "warning" : current);
    }, 2500);

    return () => {
      window.clearTimeout(pingTimer);
      if (connectorTimer.current) window.clearTimeout(connectorTimer.current);
      window.removeEventListener("message", onConnectorMessage);
    };
  }, [platform]);

  function requestConnectorSearch(searchQuery: string) {
    const normalized = searchQuery.replace(/\s+/g, " ").trim();
    if (normalized.length < 2) return;

    const requestId = window.crypto.randomUUID();
    connectorRequestId.current = requestId;
    setConnectorState("searching");
    if (platform !== "xiaohongshu") setDouyinState("searching");
    if (platform !== "douyin") setXiaohongshuState("searching");

    window.postMessage({
      source: APP_SOURCE,
      type: "GY_CHINA_CONNECTOR_SEARCH",
      requestId,
      query: normalized,
      platform,
      limit: 12,
    }, window.location.origin);

    if (connectorTimer.current) window.clearTimeout(connectorTimer.current);
    connectorTimer.current = window.setTimeout(() => {
      setConnectorState((current) => current === "searching" ? "warning" : current);
      setDouyinState((current) => current === "searching" ? "warning" : current);
      setXiaohongshuState((current) => current === "searching" ? "warning" : current);
      setNotice("Edge 검색 응답이 늦습니다. 아래 원문 검색을 열어 로그인·보안 확인을 마친 뒤 다시 검색해주세요.");
    }, 45000);
  }

  async function search(searchOverride?: string) {
    const searchQuery = (searchOverride || query).replace(/\s+/g, " ").trim();
    if (searchQuery.length < 2) {
      setError("찾을 상품명이나 중국어 검색어를 두 글자 이상 입력해주세요.");
      return;
    }

    setQuery(searchQuery);
    setSearching(true);
    setError("");
    setNotice("AI 중국어 번역, 공개검색, Edge 로그인 검색을 각각 실행하고 있습니다.");
    setSelectedIds([]);
    setResults([]);
    setTranslationState("searching");
    setPublicState("searching");

    const translationPromise = requestJson(
      "/api/china-video-lab/translate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      },
      30000,
    );

    const publicPromise = requestJson(
      "/api/creative-studio-pro/china-search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, platform, limit: 12 }),
      },
      65000,
    );

    let connectorQuery = searchQuery;

    try {
      const translated = await translationPromise;
      const name = String(translated.translatedProductName || searchQuery).trim();
      const nextKeywords = Array.isArray(translated.keywords)
        ? translated.keywords as Keyword[]
        : [];
      setTranslatedName(name);
      setKeywords(nextKeywords);
      setTranslationState("ready");
      connectorQuery = name || searchQuery;
    } catch (cause) {
      setTranslationState("warning");
      setTranslatedName(searchQuery);
      setKeywords([]);
      setNotice(
        cause instanceof Error
          ? `${cause.message} 입력값으로 Edge 검색을 계속합니다.`
          : "자동 번역은 실패했지만 Edge 검색은 계속합니다.",
      );
    }

    requestConnectorSearch(connectorQuery);

    try {
      const publicData = await publicPromise;
      const publicResults = Array.isArray(publicData.results)
        ? publicData.results as SearchResult[]
        : [];
      const publicKeywords = Array.isArray(publicData.keywords)
        ? publicData.keywords as Keyword[]
        : [];

      setResults((current) => uniqueResults([...current, ...publicResults]));
      if (publicKeywords.length) setKeywords(publicKeywords);
      if (publicData.translatedProductName) {
        setTranslatedName(String(publicData.translatedProductName));
      }
      setPublicState(publicResults.length ? "ready" : "warning");
      setNotice(String(publicData.message || "공개검색을 완료했습니다. Edge 결과는 도착하는 즉시 합쳐집니다."));
    } catch (cause) {
      setPublicState("warning");
      setNotice(
        cause instanceof Error
          ? `공개검색: ${cause.message} Edge 로그인 검색은 별도로 계속됩니다.`
          : "공개검색은 실패했지만 Edge 로그인 검색은 별도로 계속됩니다.",
      );
    } finally {
      setSearching(false);
    }
  }

  function toggleResult(id: string) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function buildReferences(items: SearchResult[]) {
    const now = Date.now();
    return items.map((item, index) => ({
      id: `china-lab-${now}-${index}`,
      platform: item.platform,
      url: item.url,
      title: item.title,
      assetKind: "page-link",
      rightsStatus: "unverified",
      useInFinal: false,
      includeInMixAnalysis: true,
      notes: `${item.note || "중국 쇼츠 검색 결과"}. 훅·촬영각도·판매 구조만 분석하고 원본 파일은 최종본에 사용하지 않습니다.`,
      analysisFrameUrls: item.thumbnailUrl ? [item.thumbnailUrl] : [],
      selectedKeywords: keywords.slice(0, 6).map((keyword) => keyword.simplifiedChinese),
      durationSeconds: item.durationSeconds,
      trimStartSecond: 0,
      trimEndSecond: null,
      createdAt: new Date().toISOString(),
    }));
  }

  async function saveToProject() {
    if (!projectId) throw new Error("먼저 저장할 쇼핑 쇼츠 프로젝트를 선택해주세요.");
    if (!selectedResults.length) throw new Error("프로젝트로 보낼 영상 카드를 하나 이상 선택해주세요.");

    const detail = await requestJson(
      `/api/creative-studio-pro/projects/${projectId}`,
      {},
      20000,
    );
    const project = detail.project as {
      settings?: { mediaReferences?: Array<Record<string, unknown>> } | null;
    };
    const existing = Array.isArray(project?.settings?.mediaReferences)
      ? project.settings.mediaReferences
      : [];
    const additions = buildReferences(selectedResults);
    const merged = Array.from(
      new Map(
        [...existing, ...additions]
          .filter((item) => typeof item.url === "string")
          .map((item) => [String(item.url), item]),
      ).values(),
    ).slice(0, 20);

    await requestJson(
      `/api/creative-studio-pro/projects/${projectId}/media-references`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references: merged }),
      },
      25000,
    );

    return additions.length;
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const count = await saveToProject();
      setNotice(`${count}개 영상 카드를 “${selectedProject?.title || "선택 프로젝트"}”의 분석 소스함에 저장했습니다.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로젝트 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrepare() {
    setPreparing(true);
    setError("");
    try {
      const count = await saveToProject();

      await requestJson(
        `/api/creative-studio-pro/projects/${projectId}/editor-settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playbackSpeed: 1.2,
            subtitleCleanupMode: "recreate-clean",
            sourceAudioMode: "mute-korean-tts",
            mixStrategy: "recreate",
          }),
        },
        20000,
      );

      setNotice("선택 영상의 훅과 장면 역할을 비교해 한국형 컷 순서를 만들고 있습니다.");
      await requestJson(
        `/api/creative-studio-pro/projects/${projectId}/source-mix`,
        { method: "POST" },
        65000,
      );

      setNotice("한국어 대본·정확한 자막·썸네일·게시정보를 만들고 있습니다.");
      await requestJson(
        `/api/creative-studio-pro/projects/${projectId}/productization`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: true }),
        },
        65000,
      );

      setNotice(`${count}개 검색 자료를 분석해 쇼핑쇼츠센터 제작 준비를 완료했습니다.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 제작 준비 실패");
    } finally {
      setPreparing(false);
    }
  }

  const services = health?.services || {};
  const serverState: StateName = health?.success ? "ready" : health ? "error" : "checking";
  const openAiState: StateName = services.openai?.configured ? "ready" : health ? "warning" : "checking";
  const supabaseState: StateName = services.supabase?.configured ? "ready" : health ? "warning" : "checking";

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>GY-NEXUS · CHINA VIDEO LAB</span>
          <h1>중국 영상 연구소</h1>
          <p>
            쇼핑쇼츠센터와 분리된 독립 검색실입니다.
            한국어 상품명을 중국어로 바꾸고 도우인·샤오홍슈 영상 카드를 찾은 뒤
            선택 결과만 제작 프로젝트로 보냅니다.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link href="/admin/shopping-shorts">쇼핑쇼츠 제작실 열기</Link>
          <Link href="/admin/connections" className={styles.secondaryLink}>통합 연결센터</Link>
        </div>
      </section>

      <section className={styles.statusBoard}>
        <div className={`${styles.statusCard} ${stateClass(serverState)}`}>
          <span>01</span><b>GY 서버</b><em>{stateText(serverState)}</em>
        </div>
        <div className={`${styles.statusCard} ${stateClass(openAiState)}`}>
          <span>02</span><b>AI 번역</b><em>{stateText(openAiState)}</em>
        </div>
        <div className={`${styles.statusCard} ${stateClass(connectorState)}`}>
          <span>03</span><b>Edge 연결</b><em>{stateText(connectorState)}</em>
        </div>
        <div className={`${styles.statusCard} ${stateClass(douyinState)}`}>
          <span>04</span><b>도우인</b><em>{stateText(douyinState)}</em>
        </div>
        <div className={`${styles.statusCard} ${stateClass(xiaohongshuState)}`}>
          <span>05</span><b>샤오홍슈</b><em>{stateText(xiaohongshuState)}</em>
        </div>
        <div className={`${styles.statusCard} ${stateClass(supabaseState)}`}>
          <span>06</span><b>프로젝트 저장</b><em>{stateText(supabaseState)}</em>
        </div>
      </section>

      <section className={styles.searchPanel}>
        <div className={styles.searchHeading}>
          <div>
            <span>STEP 1</span>
            <h2>상품 영상 찾기</h2>
            <p>검색 버튼 한 번으로 번역·공개검색·로그인 검색을 따로 실행하고 결과를 한 화면에 합칩니다.</p>
          </div>
          <strong>{results.length}<small>개 결과</small></strong>
        </div>

        <div className={styles.searchControls}>
          <label className={styles.queryField}>
            <span>한국어 상품명 또는 중국어 검색어</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !searching) void search();
              }}
              placeholder="예: 손선풍기, 세탁조 클리너, USB-C 허브"
            />
          </label>
          <label className={styles.platformField}>
            <span>검색 플랫폼</span>
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value as Platform)}
            >
              <option value="all">도우인 + 샤오홍슈</option>
              <option value="douyin">도우인만</option>
              <option value="xiaohongshu">샤오홍슈만</option>
            </select>
          </label>
          <button
            type="button"
            className={styles.searchButton}
            onClick={() => void search()}
            disabled={searching}
          >
            {searching ? "번역·검색 중…" : "중국 영상 찾기"}
          </button>
        </div>

        <div className={styles.noticeRow}>
          <p>{notice}</p>
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.manualLinks}>
          <span>검색 탭을 직접 확인해야 할 때</span>
          <a
            href={`https://www.douyin.com/search/${encodeURIComponent(activeKeyword)}?type=video`}
            target="_blank"
            rel="noreferrer"
          >
            도우인 원문 검색 ↗
          </a>
          <a
            href={`https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(activeKeyword)}`}
            target="_blank"
            rel="noreferrer"
          >
            샤오홍슈 원문 검색 ↗
          </a>
          <button
            type="button"
            onClick={() => requestConnectorSearch(activeKeyword)}
            disabled={!activeKeyword || connectorState === "searching"}
          >
            Edge 로그인 검색 다시 실행
          </button>
        </div>
      </section>

      {(translatedName || keywords.length > 0) && (
        <section className={styles.keywordPanel}>
          <div className={styles.translatedName}>
            <span>중국어 상품명</span>
            <b>{translatedName || query}</b>
            <small>아래 키워드를 누르면 해당 중국어로 다시 검색합니다.</small>
          </div>
          <div className={styles.keywordGrid}>
            {keywords.map((keyword) => (
              <button
                type="button"
                key={`${keyword.simplifiedChinese}-${keyword.intent}`}
                onClick={() => void search(keyword.simplifiedChinese)}
                disabled={searching}
              >
                <b>{keyword.simplifiedChinese}</b>
                <span>{keyword.koreanMeaning}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={styles.resultSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>STEP 2</span>
            <h2>영상 카드 선택</h2>
            <p>원본을 복제하지 않고 훅·촬영각도·판매 구조 분석용 카드만 선택합니다.</p>
          </div>
          <strong>{selectedIds.length}<small>개 선택</small></strong>
        </div>

        {results.length === 0 ? (
          <div className={styles.empty}>
            <b>아직 표시할 영상 카드가 없습니다.</b>
            <p>
              검색 후에도 비어 있다면 위 상태판에서 Edge 연결과 플랫폼 상태를 확인하고,
              원문 검색 탭의 로그인·보안 확인을 완료한 뒤 “Edge 로그인 검색 다시 실행”을 누르세요.
            </p>
          </div>
        ) : (
          <div className={styles.resultGrid}>
            {results.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <article key={item.id} className={selected ? styles.selectedCard : styles.resultCard}>
                  <button
                    type="button"
                    className={styles.cardSelect}
                    onClick={() => toggleResult(item.id)}
                    aria-pressed={selected}
                  >
                    <div className={styles.thumbnail}>
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnailUrl} alt="" loading="lazy" />
                      ) : (
                        <span>{item.platform === "douyin" ? "抖音" : "小红书"}</span>
                      )}
                      <i>{selected ? "✓ 선택됨" : "+ 선택"}</i>
                    </div>
                    <div className={styles.cardBody}>
                      <em>
                        {item.platform === "douyin" ? "도우인" : "샤오홍슈"}
                        {" · "}
                        {item.sourceMode === "browser-account" ? "Edge 로그인" : "공개검색"}
                      </em>
                      <b>{item.title || "중국 쇼츠 영상 카드"}</b>
                      <small>
                        {item.durationSeconds ? `${item.durationSeconds}초` : "길이 미공개"}
                        {" · "}
                        {item.popularityLabel || "관련 영상"}
                      </small>
                    </div>
                  </button>
                  <div className={styles.cardActions}>
                    <a href={item.url} target="_blank" rel="noreferrer">원문 영상 열기 ↗</a>
                    <span>{item.canUseOriginal ? "사용 가능" : "구조 분석 전용"}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.projectPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>STEP 3</span>
            <h2>쇼핑쇼츠 프로젝트로 보내기</h2>
            <p>선택 카드만 프로젝트 소스함으로 전달하고, 원본 사용은 자동 차단합니다.</p>
          </div>
        </div>

        <div className={styles.projectControls}>
          <label>
            <span>대상 프로젝트</span>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">프로젝트 선택</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title} · {project.product_name} · {project.duration_seconds}초
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => void handleSave()}
            disabled={saving || preparing || selectedIds.length === 0 || !projectId}
          >
            {saving ? "소스함 저장 중…" : `선택 ${selectedIds.length}개 소스함에 저장`}
          </button>
          <button
            type="button"
            className={styles.prepareButton}
            onClick={() => void handlePrepare()}
            disabled={saving || preparing || selectedIds.length === 0 || !projectId}
          >
            {preparing ? "AI 분석·제작 준비 중…" : "AI 컷·대본·자막·썸네일 준비"}
          </button>
        </div>

        {projects.length === 0 && (
          <div className={styles.projectEmpty}>
            <p>아직 쇼핑 쇼츠 프로젝트가 없습니다. 상품 사진으로 프로젝트를 먼저 만든 뒤 돌아오세요.</p>
            <Link href="/admin/shopping-shorts">새 프로젝트 만들기</Link>
          </div>
        )}
      </section>

      <section className={styles.diagnostics}>
        <div>
          <span>연결 진단</span>
          <b>검색 결과가 없을 때 화면에서 원인을 바로 확인합니다.</b>
        </div>
        <ul>
          <li>AI 번역과 공개 웹 검색은 서로 실패해도 다른 경로를 막지 않습니다.</li>
          <li>Edge 연결 검색은 공개검색 완료를 기다리지 않고 독립 실행됩니다.</li>
          <li>도우인·샤오홍슈 로그인 또는 보안 확인이 필요하면 원문 탭을 열어 완료합니다.</li>
          <li>영상 카드는 구조 분석용이며 최종 합성에는 권리를 확인한 파일만 사용됩니다.</li>
        </ul>
      </section>
    </div>
  );
}
