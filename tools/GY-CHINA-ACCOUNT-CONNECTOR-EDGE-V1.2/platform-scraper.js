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

  for (let depth = 0; depth < 9 && current?.parentElement; depth += 1) {
    current = current.parentElement;

    const textLength = (current.innerText || "").trim().length;
    const rect = current.getBoundingClientRect();
    const hasImage = Boolean(current.querySelector("img"));

    if (
      rect.width >= 90
      && rect.height >= 100
      && (hasImage || textLength >= 5)
      && textLength <= 2500
    ) {
      return current;
    }
  }

  return anchor.parentElement || anchor;
}

function titleFor(anchor, card, platform) {
  const direct = anchor.getAttribute("title")
    || anchor.getAttribute("aria-label")
    || card.querySelector("[title]")?.getAttribute("title")
    || card.querySelector("img[alt]")?.getAttribute("alt")
    || "";

  if (direct.trim().length >= 3) return direct.trim().slice(0, 160);

  const lines = String(card.innerText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length < 3 || line.length > 160) return false;
      if (/^\d+(?:\.\d+)?(?:万|w|k)?$/i.test(line)) return false;
      if (/^\d{1,2}:\d{2}$/.test(line)) return false;
      return !/^(关注|登录|点赞|评论|收藏|分享)$/.test(line);
    });

  return (lines[0] || `${platform === "douyin" ? "抖音" : "小红书"} 쇼츠 카드`).slice(0, 160);
}

function thumbnailFor(card) {
  const images = Array.from(card.querySelectorAll("img"));

  const image = images.find((item) => {
    const rect = item.getBoundingClientRect();
    return rect.width >= 60 && rect.height >= 80;
  }) || images[0];

  const candidate = image?.currentSrc || image?.src || image?.getAttribute("data-src") || "";
  return /^https:\/\//i.test(candidate) ? candidate : "";
}

function normalizePageUrl(value, platform) {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:") return "";

    if (platform === "douyin") {
      if (!/(^|\.)douyin\.com$/.test(url.hostname)) return "";

      const directVideo = url.pathname.match(/\/video\/(\d+)/);
      const modalId = url.searchParams.get("modal_id")
        || url.searchParams.get("aweme_id")
        || url.searchParams.get("item_id");

      const videoId = directVideo?.[1] || (modalId && /^\d+$/.test(modalId) ? modalId : "");
      if (!videoId) return "";

      return `https://www.douyin.com/video/${videoId}`;
    }

    if (!/(^|\.)xiaohongshu\.com$/.test(url.hostname)) return "";

    const validPath = /\/(explore|discovery\/item)\//.test(url.pathname);
    if (!validPath) return "";

    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

async function revealMoreCards() {
  const startY = window.scrollY;

  for (let index = 0; index < 5; index += 1) {
    window.scrollBy({
      top: Math.max(550, window.innerHeight * 0.8),
      left: 0,
      behavior: "instant",
    });
    await delay(850);
  }

  window.scrollTo({ top: Math.max(startY, 200), left: 0, behavior: "instant" });
  await delay(500);
}

function candidateAnchors(platform) {
  const allAnchors = Array.from(document.querySelectorAll("a[href]"));

  return allAnchors.filter((anchor) => {
    const href = anchor.getAttribute("href") || "";
    if (platform === "douyin") {
      return href.includes("/video/")
        || href.includes("modal_id=")
        || href.includes("aweme_id=")
        || href.includes("item_id=");
    }

    return href.includes("/explore/") || href.includes("/discovery/item/");
  });
}

async function scrapeVisibleShorts(platform, limit) {
  await revealMoreCards();

  const anchors = candidateAnchors(platform);
  const deduplicated = new Map();

  for (const anchor of anchors) {
    const url = normalizePageUrl(anchor.href, platform);
    if (!url || deduplicated.has(url)) continue;

    const card = cardFor(anchor);
    const rect = card.getBoundingClientRect();

    // 렌더링되지 않은 숨김 템플릿은 제외합니다.
    if (rect.width < 20 || rect.height < 20) continue;

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
    && /(登录|扫码登录|手机号登录|验证码登录)/.test(bodyText);

  const results = Array.from(deduplicated.values());

  return {
    results,
    keywords: results.flatMap((item) => item.hashtags),
    loginRequired,
    message: results.length
      ? `${results.length}개의 화면 영상 카드를 찾았습니다.`
      : `현재 화면에서 영상 카드 링크를 찾지 못했습니다. 감지한 링크 ${anchors.length}개.`,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GY_SCRAPE_VISIBLE_SHORTS") return false;

  const platform = message.platform === "xiaohongshu" ? "xiaohongshu" : "douyin";
  const limit = Math.max(2, Math.min(12, Number(message.limit) || 6));

  scrapeVisibleShorts(platform, limit)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        results: [],
        keywords: [],
        loginRequired: false,
        message: error instanceof Error ? error.message : "화면 분석 실패",
      });
    });

  return true;
});
