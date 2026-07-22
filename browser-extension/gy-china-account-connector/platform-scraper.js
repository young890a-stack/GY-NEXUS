(() => {
  if (globalThis.__GY_CHINA_SCRAPER_V12__) return;
  globalThis.__GY_CHINA_SCRAPER_V12__ = true;

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
    const matches = Array.from(String(text || "").matchAll(/(?:^|\s)((?:\d{1,2}:)?\d{1,2}:\d{2})(?:\s|$)/g));
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
    return Array.from(new Set(String(text || "").match(/#[\p{Script=Han}A-Za-z0-9_\-]{2,30}/gu) || [])).slice(0, 10);
  }

  function cardFor(anchor) {
    let current = anchor;
    for (let depth = 0; depth < 9 && current?.parentElement; depth += 1) {
      current = current.parentElement;
      const textLength = (current.innerText || "").trim().length;
      const rect = current.getBoundingClientRect();
      if (textLength >= 4 && textLength <= 3000 && rect.width >= 90 && rect.height >= 90) return current;
    }
    return anchor.parentElement || anchor;
  }

  function titleFor(anchor, card, platform) {
    const direct = anchor.getAttribute("title")
      || anchor.getAttribute("aria-label")
      || card.querySelector("[title]")?.getAttribute("title")
      || card.querySelector("[data-e2e*=title]")?.textContent
      || "";
    if (String(direct).trim().length >= 3) return String(direct).trim().slice(0, 160);
    const lines = String(card.innerText || "").split("\n").map((line) => line.trim()).filter((line) => {
      if (line.length < 3 || line.length > 160) return false;
      if (/^\d+(?:\.\d+)?(?:万|w|k)?$/i.test(line)) return false;
      if (/^\d{1,2}:\d{2}$/.test(line)) return false;
      return !/^(关注|登录|点赞|评论|收藏|分享)$/.test(line);
    });
    return (lines[0] || `${platform === "douyin" ? "抖音" : "小红书"} short-form card`).slice(0, 160);
  }

  function thumbnailFor(card) {
    const images = Array.from(card.querySelectorAll("img"));
    const image = images.find((item) => {
      const rect = item.getBoundingClientRect();
      return rect.width >= 60 && rect.height >= 75;
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
        const modalId = url.searchParams.get("modal_id");
        if (modalId && /^\d{8,30}$/.test(modalId)) return `https://www.douyin.com/video/${modalId}`;
        if (!/\/video\/\d+/.test(url.pathname)) return "";
      } else {
        if (!/(^|\.)xiaohongshu\.com$/.test(url.hostname)) return "";
        if (!/\/(explore|discovery\/item)\//.test(url.pathname)) return "";
      }
      url.hash = "";
      return url.toString();
    } catch {
      return "";
    }
  }

  function candidateAnchors(platform) {
    const selectors = platform === "douyin"
      ? [
          'a[href*="/video/"]',
          'a[href*="modal_id="]',
          '[data-e2e*="search"] a[href]',
          '[data-e2e*="video"] a[href]',
        ]
      : [
          'a[href*="/explore/"]',
          'a[href*="/discovery/item/"]',
          'section.note-item a[href]',
          '.note-item a[href]',
          'a.cover[href]',
        ];
    return Array.from(new Set(selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))));
  }

  function securityRequiredText(bodyText) {
    return /(验证码|安全验证|滑块|访问过于频繁|异常请求|网络异常|verify|captcha)/i.test(bodyText);
  }

  async function scrapeVisibleShorts(platform, limit) {
    const deduplicated = new Map();
    let anchorsSeen = 0;
    for (let pass = 0; pass < 4; pass += 1) {
      const distance = Math.min(document.documentElement.scrollHeight - window.innerHeight, 550 + pass * 850);
      window.scrollTo({ top: Math.max(0, distance), behavior: "instant" });
      await delay(900 + pass * 250);
      const anchors = candidateAnchors(platform);
      anchorsSeen = Math.max(anchorsSeen, anchors.length);
      for (const anchor of anchors) {
        const href = anchor.href || anchor.getAttribute("href") || "";
        const url = normalizePageUrl(href, platform);
        if (!url || deduplicated.has(url)) continue;
        const card = cardFor(anchor);
        const text = String(card.innerText || card.textContent || "").trim();
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
          popularityLabel: likes === null ? `계정 검색 상위 ${rank}` : `화면 좋아요 ${likes.toLocaleString("ko-KR")}`,
          note: "Edge 로그인 계정의 실제 검색 화면에서 가져온 공개 카드 · 원본 파일 아님",
          rightsStatus: "unverified",
          canUseOriginal: false,
          sourceLabel: "Edge 로그인 계정 검색",
          sourceMode: "browser-account",
          nativeRank: rank,
          hashtags: hashtags(text),
        });
        if (deduplicated.size >= limit) break;
      }
      if (deduplicated.size >= limit) break;
    }

    const bodyText = String(document.body?.innerText || "");
    const loginRequired = deduplicated.size === 0 && /(登录|扫码登录|手机号登录|请先登录)/.test(bodyText);
    const securityRequired = deduplicated.size === 0 && securityRequiredText(bodyText);
    const results = Array.from(deduplicated.values());
    const diagnostics = {
      path: window.location.pathname,
      title: document.title,
      anchorsSeen,
      cardsFound: results.length,
      bodyLength: bodyText.length,
    };

    return {
      results,
      keywords: results.flatMap((item) => item.hashtags),
      loginRequired,
      securityRequired,
      diagnostics,
      message: results.length
        ? `${results.length}개 공개 영상 카드를 찾았습니다.`
        : loginRequired
          ? "로그인이 필요합니다. 열린 탭에서 로그인한 뒤 GY-NEXUS에서 다시 검색하세요."
          : securityRequired
            ? "보안 확인 또는 캡차가 필요합니다. 열린 탭에서 확인을 완료한 뒤 다시 검색하세요."
            : `영상 링크를 찾지 못했습니다. 화면 구조가 바뀌었거나 검색 결과 로딩이 지연됐습니다. (${window.location.pathname}, anchor ${anchorsSeen})`,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GY_SCRAPER_PING") {
      sendResponse({ success: true, version: "1.2.0" });
      return false;
    }
    if (message?.type !== "GY_SCRAPE_VISIBLE_SHORTS") return false;
    const platform = message.platform === "xiaohongshu" ? "xiaohongshu" : "douyin";
    const limit = Math.max(2, Math.min(12, Number(message.limit) || 6));
    scrapeVisibleShorts(platform, limit)
      .then(sendResponse)
      .catch((error) => sendResponse({
        results: [],
        keywords: [],
        loginRequired: false,
        securityRequired: false,
        diagnostics: { path: window.location.pathname, title: document.title },
        message: error instanceof Error ? error.message : "검색 화면 분석에 실패했습니다.",
      }));
    return true;
  });
})();
