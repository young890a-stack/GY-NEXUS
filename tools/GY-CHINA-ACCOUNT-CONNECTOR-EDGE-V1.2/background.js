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

async function waitForTab(tabId, timeoutMilliseconds = 30000) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") return;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("중국 플랫폼 검색 화면을 불러오는 시간이 너무 오래 걸립니다."));
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

  if (!tab.id) {
    throw new Error(`${platform} 검색 탭을 만들지 못했습니다.`);
  }

  try {
    await waitForTab(tab.id);
    await delay(3200);

    let response = null;

    // 중국 플랫폼은 카드가 늦게 그려지는 경우가 많아 여러 번 확인합니다.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          type: "GY_SCRAPE_VISIBLE_SHORTS",
          platform,
          limit,
          attempt,
        });
      } catch {
        response = null;
      }

      if (response?.results?.length || response?.loginRequired) break;
      await delay(1700);
    }

    if (response?.loginRequired) {
      await chrome.tabs.update(tab.id, { active: true });
      return {
        platform,
        results: [],
        keywords: [],
        message: `${platform === "douyin" ? "도우인" : "샤오홍슈"} 로그인이 필요합니다. 열린 탭에서 로그인한 뒤 GY-NEXUS에서 다시 검색해주세요.`,
        tabKeptOpen: true,
      };
    }

    const results = Array.isArray(response?.results) ? response.results : [];
    const keywords = Array.isArray(response?.keywords) ? response.keywords : [];

    if (results.length === 0) {
      // 아무 결과도 없을 때 탭을 닫지 않고 보여줘서 차단·로그인·화면 상태를 확인할 수 있게 합니다.
      await chrome.tabs.update(tab.id, { active: true });
      return {
        platform,
        results: [],
        keywords: [],
        message: `${platform === "douyin" ? "도우인" : "샤오홍슈"} 검색 탭을 열었습니다. 화면에 영상이 보이면 잠시 기다린 뒤 GY-NEXUS에서 다시 검색해주세요.`,
        tabKeptOpen: true,
      };
    }

    await chrome.tabs.remove(tab.id).catch(() => undefined);

    return {
      platform,
      results,
      keywords,
      message: response?.message || "",
      tabKeptOpen: false,
    };
  } catch (error) {
    await chrome.tabs.update(tab.id, { active: true }).catch(() => undefined);
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

async function runNativeSearch(message) {
  const query = String(message.query || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const platform = ["all", "douyin", "xiaohongshu"].includes(message.platform)
    ? message.platform
    : "all";
  const limit = Math.max(4, Math.min(12, Number(message.limit) || 12));

  if (query.length < 2) {
    return { success: false, message: "검색어를 두 글자 이상 입력해주세요." };
  }

  const platforms = platform === "all" ? ["douyin", "xiaohongshu"] : [platform];
  const groups = [];
  const failures = [];

  // 동시에 두 탭을 열면 중국 플랫폼이 로딩을 제한하는 경우가 있어 순서대로 검색합니다.
  for (const item of platforms) {
    try {
      groups.push(await scrapePlatform(item, query, Math.ceil(limit / platforms.length)));
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `${item} 검색 실패`);
    }
  }

  const results = groups.flatMap((group) => group.results || []).slice(0, limit);
  const groupMessages = groups.map((group) => group.message).filter(Boolean);
  const messages = [...groupMessages, ...failures];

  return {
    success: groups.length > 0,
    results,
    keywords: keywordFrequency(groups),
    message: results.length
      ? `${results.length}개의 로그인 계정 영상 카드를 가져왔습니다.${failures.length ? " 일부 플랫폼은 응답하지 않았습니다." : ""}`
      : messages.join(" ") || "검색 화면에서 영상 카드를 찾지 못했습니다.",
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GY_CONNECTOR_PING") {
    sendResponse({ success: safeSender(sender) });
    return false;
  }

  if (message?.type !== "GY_NATIVE_CHINA_SEARCH" || !safeSender(sender)) {
    return false;
  }

  runNativeSearch(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        success: false,
        message: error instanceof Error ? error.message : "로그인 계정 검색에 실패했습니다.",
      });
    });

  return true;
});
