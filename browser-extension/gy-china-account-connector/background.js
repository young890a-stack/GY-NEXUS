const GY_HOSTS = new Set(["gy-nexus-zfpq.vercel.app", "localhost"]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeSender(sender) {
  try {
    return GY_HOSTS.has(new URL(sender.tab?.url || sender.url || "").hostname);
  } catch {
    return false;
  }
}

async function waitForTab(tabId, timeoutMilliseconds = 25000) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("플랫폼 검색 페이지가 25초 안에 열리지 않았습니다."));
    }, timeoutMilliseconds);
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function searchUrl(platform, query) {
  if (platform === "douyin") {
    return `https://www.douyin.com/search/${encodeURIComponent(query)}?type=video`;
  }
  return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes`;
}

async function scrapePlatform(platform, query, limit) {
  const tab = await chrome.tabs.create({
    url: searchUrl(platform, query),
    active: false,
  });
  if (!tab.id) throw new Error(`${platform} 검색 탭을 만들지 못했습니다.`);

  try {
    await waitForTab(tab.id);
    await delay(5000);

    let response = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          type: "GY_SCRAPE_VISIBLE_SHORTS",
          platform,
          limit,
        });
      } catch {
        response = null;
      }
      if (response?.results?.length || response?.loginRequired) break;
      await delay(2000);
    }

    if (response?.loginRequired) {
      await chrome.tabs.update(tab.id, { active: true });
      return {
        platform,
        results: [],
        keywords: [],
        message: `${platform === "douyin" ? "도우인" : "샤오홍슈"} 로그인이 필요합니다. 열린 탭에서 로그인한 뒤 다시 검색하세요.`,
      };
    }

    await chrome.tabs.remove(tab.id).catch(() => undefined);

    return {
      platform,
      results: Array.isArray(response?.results) ? response.results : [],
      keywords: Array.isArray(response?.keywords) ? response.keywords : [],
      message: response?.message || "",
    };
  } catch (error) {
    await chrome.tabs.remove(tab.id).catch(() => undefined);
    throw error;
  }
}

function keywordFrequency(groups) {
  const counts = new Map();
  for (const value of groups.flatMap((group) => group.keywords || [])) {
    const keyword = String(value || "").replace(/^#/, "").trim();
    if (keyword.length < 2 || keyword.length > 30) continue;
    counts.set(keyword, (counts.get(keyword) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, 10);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GY_CONNECTOR_PING") {
    sendResponse({ success: safeSender(sender) });
    return false;
  }

  if (message?.type !== "GY_NATIVE_CHINA_SEARCH" || !safeSender(sender)) {
    return false;
  }

  const query = String(message.query || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const platform = ["all", "douyin", "xiaohongshu"].includes(message.platform)
    ? message.platform
    : "all";
  const limit = Math.max(4, Math.min(12, Number(message.limit) || 12));

  if (query.length < 2) {
    sendResponse({ success: false, message: "중국어 검색어를 두 글자 이상 입력해주세요." });
    return false;
  }

  const platforms = platform === "all"
    ? ["douyin", "xiaohongshu"]
    : [platform];

  Promise.allSettled(
    platforms.map((item) => scrapePlatform(
      item,
      query,
      Math.ceil(limit / platforms.length),
    )),
  ).then((settled) => {
    const groups = settled.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const results = groups.flatMap((group) => group.results).slice(0, limit);
    const failures = settled.filter((result) => result.status === "rejected");

    sendResponse({
      success: groups.length > 0,
      results,
      keywords: keywordFrequency(groups),
      message: results.length
        ? `${results.length}개 로그인 검색 영상을 가져왔습니다.${failures.length ? " 일부 플랫폼은 응답하지 않았습니다." : ""}`
        : groups.map((group) => group.message).filter(Boolean).join(" ")
          || failures.map((item) => item.reason?.message || "").filter(Boolean).join(" ")
          || "검색 화면에서 영상 카드를 찾지 못했습니다.",
    });
  }).catch((error) => sendResponse({
    success: false,
    message: error instanceof Error ? error.message : "계정 검색에 실패했습니다.",
  }));

  return true;
});
