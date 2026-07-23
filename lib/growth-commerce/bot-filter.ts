// lib/growth-commerce/bot-filter.ts
//
// 클릭은 이 시스템의 핵심 지표입니다.
// 크롤러와 링크 미리보기 봇이 섞이면 commerce_score 와 학습 규칙이 전부 오염됩니다.
//
// ★ 한국 서비스에서 특히 조심할 점 ★
//   - 카카오톡 "인앱 브라우저"의 UA 에는 KAKAOTALK 이 들어갑니다. 이건 진짜 사용자입니다.
//     링크 미리보기 봇은 kakaotalk-scrap 입니다. 이것만 걸러야 합니다.
//   - 네이버 앱 인앱 브라우저는 NAVER(inapp;...) 이고, 크롤러는 Yeti 입니다.
//   "kakaotalk" 이나 "naver" 를 통째로 막으면 실제 고객 클릭을 버리게 됩니다.

const BOT_PATTERN = new RegExp(
  [
    // 링크 미리보기 (프리뷰) 봇
    "kakaotalk-scrap", "facebookexternalhit", "facebot", "twitterbot",
    "linkedinbot", "slackbot", "slack-imgproxy", "discordbot",
    "telegrambot", "whatsapp", "skypeuripreview", "embedly", "quora link preview",
    // 검색 크롤러
    "googlebot", "bingbot", "applebot", "duckduckbot", "baiduspider",
    "yandexbot", "petalbot", "yeti", "naverbot", "daumoa",
    // SEO / 수집 도구
    "ahrefsbot", "semrushbot", "mj12bot", "dotbot", "dataforseo",
    // AI 크롤러
    "gptbot", "claudebot", "anthropic-ai", "ccbot", "perplexitybot",
    "amazonbot", "bytespider", "google-extended",
    // 스크립트/모니터링
    "python-requests", "curl/", "wget/", "axios/", "okhttp", "go-http-client",
    "java/", "libwww-perl", "headlesschrome", "phantomjs", "puppeteer", "playwright",
    "uptimerobot", "pingdom", "statuscake", "vercel-screenshot",
    // 포괄 키워드 (위에서 안 잡힌 것들)
    "crawler", "spider", "scraper", "fetcher", "slurp",
  ].join("|"),
  "i",
);

// UA 에 'bot' 이 들어가지만 실제 사용자인 경우가 있어 단어 경계로 따로 검사합니다.
const GENERIC_BOT_WORD = /\bbot\b|_bot|bot[/_-]/i;

export type ClickFilterResult =
  | { record: true }
  | { record: false; reason: "no-user-agent" | "bot" | "prefetch" };

/**
 * 이 요청을 클릭으로 기록해도 되는지 판단합니다.
 * 기록하지 않더라도 리다이렉트는 정상적으로 해줍니다 (사용자 경험 우선).
 */
export function shouldRecordClick(headers: Headers): ClickFilterResult {
  const ua = headers.get("user-agent")?.trim() ?? "";

  // UA 가 아예 없으면 정상 브라우저가 아닙니다.
  if (!ua) return { record: false, reason: "no-user-agent" };

  // 브라우저 선읽기(prefetch) — 사용자가 실제로 누른 것이 아닙니다.
  const purpose = headers.get("purpose") ?? headers.get("x-purpose") ?? "";
  const moz = headers.get("x-moz") ?? "";
  const secPurpose = headers.get("sec-purpose") ?? "";
  if (/prefetch|preview|prerender/i.test(`${purpose} ${moz} ${secPurpose}`)) {
    return { record: false, reason: "prefetch" };
  }

  if (BOT_PATTERN.test(ua) || GENERIC_BOT_WORD.test(ua)) {
    return { record: false, reason: "bot" };
  }

  return { record: true };
}
