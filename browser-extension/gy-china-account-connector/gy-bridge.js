const REQUEST_SOURCE = "GY_NEXUS";
const RESPONSE_SOURCE = "GY_CHINA_CONNECTOR";

function postToSite(payload) {
  window.postMessage({ source: RESPONSE_SOURCE, ...payload }, window.location.origin);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "GY_CONNECTOR_SITE_EVENT") return false;
  postToSite(message.payload || {});
  return false;
});

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const message = event.data;
  if (!message || message.source !== REQUEST_SOURCE) return;

  if (message.type === "GY_CHINA_CONNECTOR_PING") {
    chrome.runtime.sendMessage({ type: "GY_CONNECTOR_PING" }, (response) => {
      if (chrome.runtime.lastError || !response?.success) return;
      postToSite({
        type: "GY_CHINA_CONNECTOR_PONG",
        version: response.version || "",
      });
    });
    return;
  }

  if (message.type !== "GY_CHINA_CONNECTOR_SEARCH") return;

  chrome.runtime.sendMessage({
    type: "GY_NATIVE_CHINA_SEARCH",
    requestId: String(message.requestId || ""),
    query: String(message.query || ""),
    platform: String(message.platform || "all"),
    limit: Number(message.limit) || 12,
  }, (response) => {
    const payload = chrome.runtime.lastError
      ? { success: false, message: chrome.runtime.lastError.message }
      : response;

    postToSite({
      type: "GY_CHINA_CONNECTOR_RESULTS",
      requestId: message.requestId,
      ...(payload || {
        success: false,
        message: "Edge 연결기 응답이 없습니다. 확장 프로그램을 다시 로드해주세요.",
      }),
    });
  });
});
