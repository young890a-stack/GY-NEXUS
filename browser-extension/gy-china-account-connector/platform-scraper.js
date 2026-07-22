function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function metricNumber(value) {
  const match = String(value || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(万|w|k)?/i);
  if (!match) return null;
  const unit = String(match[2] || "").toLowerCase();
  const multiplier = unit === "万" || unit === "w" ? 10000 : unit === "k" ? 1000 : 1;
  return Math.round(Number(match[1]) * multiplier);
}

function durationSeconds(text) {
  const matches = Array.from(
    String(text || "").matchAll(/(?:^|\s)((?:\d{1,2}:)?\d{1,2}:\d{2})(?:\s|$)/g),
  );
  for (const match of matches) {
    const parts = match[1].split(":").map(Number);
    const seconds = parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];
    if (seconds > 0 && seconds <= 86400) return seconds;
  }
  return null;
}

function publicLikes(text) {
  const patterns = [
    /(?:点赞|获赞|喜欢|赞)\s*[:：]?\s*(\d+(?:\.\d+)?\s*(?:万|w|k)?)/i,
    /(\d+(?:\.\d+)?\s*(?:万|w|k))\s*(?:点赞|赞|喜欢)?/i,
  ];
  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) return metricNumber(match[1]);
  }
  return null;
}

function hashtags(text) {
  return Array.from(
    new Set(String(text || "").match(/#[\p{Script=Han}A-Za-z0-9_\-]{2,30}/gu) || []),
  ).slice(0, 10);
}

function cardFor(anchor) {
  let current = anchor;
  for (let depth = 0; depth < 8 && current?.parentElement; depth += 1) {
    current = current.parentElement;
    const textLength = (current.innerText || "").trim().length;
    const rect = current.getBoundingClientRect();
    if (textLength >= 6 && textLength <= 2400 && rect.width >= 100 && rect.height >= 110) {
      return current;
    }
  }
  return anchor.parentElement || anchor;
}

function titleFor(anchor, card, platform) {
  const direct = anchor.getAttribute("title")
    || anchor.getAttribute("aria-label")
    || card.querySelector("[title]")?.getAttribute("title")
    || "";
  if (direct.trim().length >= 3) return direct.trim().slice(0, 160);

  const lines = String(card.innerText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length < 3 || line.length > 160) return false;
      if (/^\d+(?:\.\d+)?(?:万|w|k)?$/i.test(line)) return false;
      if (/^\d{1,2}:\d{2}$/.test(line)) return false;
      return !/^(关注|登录|点赞|评论|收藏)$/.test(line);
    });

  return (lines[0] || `${platform === "douyin" ? "抖音" : "小红书"} short-form card`)
    .slice(0, 160);
}

function thumbnailFor(card) {
  const image = Array.from(card.querySelectorAll("img")).find((item) => {
    const rect = item.getBoundingClientRect();
    return rect.width >= 70 && rect.height >= 90;
  });
  const candidate = image?.currentSrc || image?.src || "";
  return /^https:\/\//i.test(candidate) ? candidate : "";
}

function normalizePageUrl(value, platform) {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:") return "";

    const valid = platform === "douyin"
      ? /(^|\.)douyin\.com$/.test(url.hostname) && /\/video\//.test(url.pathname)
      : /(^|\.)xiaohongshu\.com$/.test(url.hostname)
        && /\/(explore|discovery\/item)\//.test(url.pathname);

    if (!valid) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

async function scrapeVisibleShorts(platform, limit) {
  window.scrollTo(0, Math.min(document.documentElement.scrollHeight * 0.55, 1800));
  await delay(1200);

  const selector = platform === "douyin"
    ? 'a[href*="/video/"]'
    : 'a[href*="/explore/"],a[href*="/discovery/item/"]';

  const anchors = Array.from(document.querySelectorAll(selector));
  const deduplicated = new Map();

  for (const anchor of anchors) {
    const url = normalizePageUrl(anchor.href, platform);
    if (!url || deduplicated.has(url)) continue;

    const card = cardFor(anchor);
    const text = String(card.innerText || "").trim();
    const duration = durationSeconds(text);
    if (duration !== null && duration > 60) continue;

    const likes = publicLikes(text);
    const rank = deduplicated.size + 1;

    deduplicated.set(url, {
      id: `native-${platform}-${rank}-${Date.now()}`,
      platform,
      title: titleFor(anchor, card, platform),
      url,
      thumbnailUrl: thumbnailFor(card),
      durationSeconds: duration,
      engagement: { likes, comments: null, saves: null },
      popularityLabel: likes === null
        ? `계정 검색 상위 ${rank}`
        : `화면 좋아요 ${likes.toLocaleString("ko-KR")}`,
      note: "Edge 로그인 계정의 실제 검색 화면에서 가져온 쇼츠 카드 · 원본 파일 아님",
      rightsStatus: "unverified",
      canUseOriginal: false,
      sourceLabel: "Edge 로그인 계정 검색",
      sourceMode: "browser-account",
      nativeRank: rank,
      hashtags: hashtags(text),
    });

    if (deduplicated.size >= limit) break;
  }

  const bodyText = String(document.body?.innerText || "");
  const loginRequired = deduplicated.size === 0
    && /(登录|扫码登录|手机号登录|请先登录)/.test(bodyText);

  const results = Array.from(deduplicated.values());

  return {
    results,
    keywords: results.flatMap((item) => item.hashtags),
    loginRequired,
    message: results.length
      ? `${results.length} visible short-form cards found.`
      : `검색 페이지에서 지원되는 영상 링크를 찾지 못했습니다. 현재 주소: ${window.location.pathname}`,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GY_SCRAPE_VISIBLE_SHORTS") return false;
  const platform = message.platform === "xiaohongshu" ? "xiaohongshu" : "douyin";
  const limit = Math.max(2, Math.min(12, Number(message.limit) || 6));

  scrapeVisibleShorts(platform, limit)
    .then(sendResponse)
    .catch((error) => sendResponse({
      results: [],
      keywords: [],
      loginRequired: false,
      message: error instanceof Error ? error.message : "검색 화면 분석에 실패했습니다.",
    }));

  return true;
});
