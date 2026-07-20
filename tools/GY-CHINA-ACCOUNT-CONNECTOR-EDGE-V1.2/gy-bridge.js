const REQUEST_SOURCE = "GY_NEXUS";
const RESPONSE_SOURCE = "GY_CHINA_CONNECTOR";

let lastAppSearchAt = 0;
let fallbackTimer = null;
let fallbackInFlight = false;

function postConnectorResult(requestId, payload) {
  window.postMessage({
    source: RESPONSE_SOURCE,
    type: "GY_CHINA_CONNECTOR_RESULTS",
    requestId,
    ...(payload || {
      success: false,
      message: "Edge 연결 도우미에서 응답을 받지 못했습니다.",
    }),
  }, window.location.origin);
}

function runNativeSearch({ query, platform = "all", limit = 12, requestId = "" }) {
  const normalizedQuery = String(query || "").replace(/\s+/g, " ").trim();

  if (normalizedQuery.length < 2 || fallbackInFlight) return;

  fallbackInFlight = true;

  chrome.runtime.sendMessage({
    type: "GY_NATIVE_CHINA_SEARCH",
    requestId,
    query: normalizedQuery,
    platform,
    limit,
  }, (response) => {
    const payload = chrome.runtime.lastError
      ? { success: false, message: chrome.runtime.lastError.message }
      : response;

    postConnectorResult(requestId, payload);
    fallbackInFlight = false;
  });
}

function pageSearchInput() {
  const input = document.querySelector(".china-source-search input, input[placeholder*=\"손선풍기\"], input[placeholder*=\"세탁조\"]");
  return input instanceof HTMLInputElement ? input.value.trim() : "";
}

function pagePlatform() {
  const select = document.querySelector(".china-source-search select, select");
  const value = select instanceof HTMLSelectElement ? select.value : "all";
  return ["all", "douyin", "xiaohongshu"].includes(value) ? value : "all";
}

function translatedPageKeyword() {
  const translated = document.querySelector(".china-keyword-panel strong")?.textContent?.trim() || "";
  return translated.length >= 2 ? translated : "";
}

function scheduleIndependentFallback() {
  const clickedAt = Date.now();

  if (fallbackTimer) clearTimeout(fallbackTimer);

  // 사이트 공개검색이 성공하면 기존 GY 요청을 사용합니다.
  // 사이트 요청이 오지 않으면 확장 프로그램이 독립적으로 로그인 검색을 실행합니다.
  fallbackTimer = setTimeout(() => {
    if (lastAppSearchAt >= clickedAt) return;

    const query = translatedPageKeyword() || pageSearchInput();
    if (query.length < 2) return;

    runNativeSearch({
      query,
      platform: pagePlatform(),
      limit: 12,
      requestId: `edge-fallback-${Date.now()}`,
    });
  }, 4500);
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;

  const message = event.data;
  if (!message || message.source !== REQUEST_SOURCE) return;

  if (message.type === "GY_CHINA_CONNECTOR_PING") {
    chrome.runtime.sendMessage({ type: "GY_CONNECTOR_PING" }, (response) => {
      if (chrome.runtime.lastError || !response?.success) return;
      window.postMessage({
        source: RESPONSE_SOURCE,
        type: "GY_CHINA_CONNECTOR_PONG",
      }, window.location.origin);
    });
    return;
  }

  if (message.type !== "GY_CHINA_CONNECTOR_SEARCH") return;

  lastAppSearchAt = Date.now();

  runNativeSearch({
    query: message.query,
    platform: message.platform,
    limit: message.limit,
    requestId: String(message.requestId || ""),
  });
});

// 기존 사이트 검색 API가 실패해도 버튼 클릭 후 로그인 계정 검색이 독립적으로 실행되도록 보완합니다.
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest("button");
  if (!button) return;

  const label = button.textContent?.replace(/\s+/g, " ").trim() || "";

  if (label.includes("중국어로 자동 번역해 찾기")) {
    scheduleIndependentFallback();
  }

  if (label.includes("로그인 계정으로 다시 찾기")) {
    const query = translatedPageKeyword() || pageSearchInput();
    runNativeSearch({
      query,
      platform: pagePlatform(),
      limit: 12,
      requestId: `edge-manual-${Date.now()}`,
    });
  }
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.closest(".china-source-search")) return;
  scheduleIndependentFallback();
}, true);
