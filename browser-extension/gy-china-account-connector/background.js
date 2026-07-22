const VERSION = "1.2.0";
const GY_HOSTS = new Set([
  "gy-nexus-zfpq.vercel.app",
  "app.gywealthlab.com",
  "ai.gylabs.kr",
  "localhost",
]);

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

async function notify(sender, payload) {
  if (!sender.tab?.id) return;
  try {
    await chrome.tabs.sendMessage(sender.tab.id, {
      type: "GY_CONNECTOR_SITE_EVENT",
      payload: {
        source: "GY_CHINA_CONNECTOR",
        type: "GY_CHINA_CONNECTOR_PROGRESS",
        ...payload,
      },
    });
  } catch {
    // The final sendResponse still returns the outcome.
  }
}

async function waitForTab(tabId, timeoutMilliseconds = 30000) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("플랫폼 검색 페이지가 30초 안에 열리지 않았습니다."));
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

async function ensureScraper(tabId) {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: "GY_SCRAPER_PING" });
    if (pong?.success) return;
  } catch {
    // Reinject below.
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["platform-scraper.js"],
  });
  await delay(700);
}

async function scrapePlatform(platform, query, limit, sender) {
  await notify(sender, {
    platform,
    stage: "opening",
    message: `${platform === "douyin" ? "도우인" : "샤오홍슈"} 검색 탭을 열고 있습니다.`,
  });

  const tab = await chrome.tabs.create({
    url: searchUrl(platform, query),
    active: false,
  });
  if (!tab.id) throw new Error(`${platform} 검색 탭을 만들지 못했습니다.`);

  let keepOpen = false;
  try {
    await waitForTab(tab.id);
    await notify(sender, {
      platform,
      stage: "loading",
      message: `${platform === "douyin" ? "도우인" : "샤오홍슈"} 화면 로딩 완료 · 카드 분석 준비`,
    });
    await delay(3500);
    await ensureScraper(tab.id);

    let response = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await notify(sender, {
        platform,
        stage: "scraping",
        message: `${platform === "douyin" ? "도우인" : "샤오홍슈"} 영상 카드 분석 ${attempt}/4`,
      });
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          type: "GY_SCRAPE_VISIBLE_SHORTS",
          platform,
          limit,
          attempt,
        });
      } catch (error) {
        await ensureScraper(tab.id);
        response = { results: [], message: error instanceof Error ? error.message : "콘텐츠 스크립트 응답 없음" };
      }
      if (response?.results?.length || response?.loginRequired || response?.securityRequired) break;
      await delay(1700);
    }

    const needsAction = Boolean(response?.loginRequired || response?.securityRequired || !response?.results?.length);
    if (needsAction) {
      keepOpen = true;
      await chrome.tabs.update(tab.id, { active: true });
      await notify(sender, {
        platform,
        stage: "action",
        message: response?.message || `${platform} 탭에서 로그인 또는 보안 확인이 필요합니다.`,
      });
    } else {
      await notify(sender, {
        platform,
        stage: "complete",
        message: `${platform === "douyin" ? "도우인" : "샤오홍슈"} 영상 ${response.results.length}개 수집 완료`,
      });
    }

    return {
      platform,
      status: needsAction ? "action" : "complete",
      needsAction,
      results: Array.isArray(response?.results) ? response.results : [],
      keywords: Array.isArray(response?.keywords) ? response.keywords : [],
      message: response?.message || "",
      diagnostics: response?.diagnostics || {},
      tabUrl: (await chrome.tabs.get(tab.id)).url || "",
    };
  } finally {
    if (!keepOpen) {
      await chrome.tabs.remove(tab.id).catch(() => undefined);
    }
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
    sendResponse({ success: safeSender(sender), version: VERSION });
    return false;
  }

  if (message?.type !== "GY_NATIVE_CHINA_SEARCH" || !safeSender(sender)) {
    return false;
  }

  const query = String(message.query || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const platform = ["all", "douyin", "xiaohongshu"].includes(message.platform)
    ? message.platform
    : "all";
  const limit = Math.max(4, Math.min(20, Number(message.limit) || 12));

  if (query.length < 2) {
    sendResponse({ success: false, message: "중국어 검색어를 두 글자 이상 입력해주세요." });
    return false;
  }

  const platforms = platform === "all" ? ["douyin", "xiaohongshu"] : [platform];

  (async () => {
    const groups = [];
    const failures = [];
    for (const item of platforms) {
      try {
        const result = await scrapePlatform(item, query, Math.ceil(limit / platforms.length), sender);
        groups.push(result);
      } catch (error) {
        const messageText = error instanceof Error ? error.message : `${item} 검색 실패`;
        failures.push({ platform: item, message: messageText });
        await notify(sender, { platform: item, stage: "action", message: messageText });
      }
      await delay(800);
    }

    const results = groups.flatMap((group) => group.results).slice(0, limit);
    const needsAction = groups.some((group) => group.needsAction) || failures.length > 0;
    const platformReport = {};
    for (const group of groups) {
      platformReport[group.platform] = {
        status: group.status,
        message: group.message,
        count: group.results.length,
        diagnostics: group.diagnostics,
        tabUrl: group.tabUrl,
      };
    }
    for (const failure of failures) {
      platformReport[failure.platform] = { status: "error", message: failure.message, count: 0 };
    }

    return {
      success: results.length > 0,
      results,
      keywords: keywordFrequency(groups),
      needsAction,
      platforms: platformReport,
      message: results.length
        ? `${results.length}개 로그인 검색 영상을 가져왔습니다.${needsAction ? " 일부 플랫폼 탭에서 확인이 필요합니다." : ""}`
        : groups.map((group) => group.message).filter(Boolean).join(" ")
          || failures.map((item) => item.message).join(" ")
          || "검색 화면에서 영상 카드를 찾지 못했습니다.",
    };
  })().then(sendResponse).catch((error) => sendResponse({
    success: false,
    needsAction: true,
    message: error instanceof Error ? error.message : "계정 검색에 실패했습니다.",
  }));

  return true;
});
