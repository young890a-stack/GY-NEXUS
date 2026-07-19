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

async function waitForTab(tabId, timeoutMilliseconds = 20000) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("The platform search page took too long to load."));
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
  if (platform === "douyin") return `https://www.douyin.com/search/${encodeURIComponent(query)}?type=video`;
  return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes`;
}

async function scrapePlatform(platform, query, limit) {
  const tab = await chrome.tabs.create({ url: searchUrl(platform, query), active: false });
  if (!tab.id) throw new Error(`${platform} search tab could not be created.`);
  try {
    await waitForTab(tab.id);
    await delay(4200);
    let response = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await chrome.tabs.sendMessage(tab.id, { type: "GY_SCRAPE_VISIBLE_SHORTS", platform, limit });
      } catch {
        response = null;
      }
      if (response?.results?.length || response?.loginRequired) break;
      await delay(1800);
    }
    if (response?.loginRequired) {
      await chrome.tabs.update(tab.id, { active: true });
      return { platform, results: [], keywords: [], message: `${platform} login is required. Sign in on the opened tab and search again.` };
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
  if (message?.type !== "GY_NATIVE_CHINA_SEARCH" || !safeSender(sender)) return false;

  const query = String(message.query || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const platform = ["all", "douyin", "xiaohongshu"].includes(message.platform) ? message.platform : "all";
  const limit = Math.max(4, Math.min(12, Number(message.limit) || 12));
  if (query.length < 2) {
    sendResponse({ success: false, message: "Enter at least two characters for the account search." });
    return false;
  }

  const platforms = platform === "all" ? ["douyin", "xiaohongshu"] : [platform];
  Promise.allSettled(platforms.map((item) => scrapePlatform(item, query, Math.ceil(limit / platforms.length))))
    .then((settled) => {
      const groups = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const results = groups.flatMap((group) => group.results).slice(0, limit);
      const failures = settled.filter((result) => result.status === "rejected").length;
      sendResponse({
        success: groups.length > 0,
        results,
        keywords: keywordFrequency(groups),
        message: results.length
          ? `${results.length} account-visible short-form cards collected.${failures ? " Some platform pages did not respond." : ""}`
          : groups.map((group) => group.message).filter(Boolean).join(" ") || "No visible short-form cards were found.",
      });
    })
    .catch((error) => sendResponse({ success: false, message: error instanceof Error ? error.message : "Account search failed." }));
  return true;
});
