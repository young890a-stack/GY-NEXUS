const REQUEST_SOURCE = "GY_NEXUS";
const RESPONSE_SOURCE = "GY_CHINA_CONNECTOR";

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const message = event.data;
  if (!message || message.source !== REQUEST_SOURCE) return;

  if (message.type === "GY_CHINA_CONNECTOR_PING") {
    chrome.runtime.sendMessage({ type: "GY_CONNECTOR_PING" }, (response) => {
      if (chrome.runtime.lastError || !response?.success) return;
      window.postMessage(
        { source: RESPONSE_SOURCE, type: "GY_CHINA_CONNECTOR_PONG" },
        window.location.origin,
      );
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

    window.postMessage({
      source: RESPONSE_SOURCE,
      type: "GY_CHINA_CONNECTOR_RESULTS",
      requestId: message.requestId,
      ...(payload || {
        success: false,
        message: "Edge 연결기에서 응답이 없습니다. 확장 프로그램을 새로고침해주세요.",
      }),
    }, window.location.origin);
  });
});
