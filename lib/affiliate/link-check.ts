import type { AffiliateLinkCheck, AffiliatePlatform } from "./types";

function isDomain(host: string, root: string) {
  return host === root || host.endsWith(`.${root}`);
}

export function detectAffiliatePlatform(url: URL): AffiliatePlatform | "unknown" {
  const host = url.hostname.toLowerCase();
  if (isDomain(host, "coupang.com") || host === "coupa.ng") return "coupang";
  if (isDomain(host, "temu.com") || host === "temu.to") return "temu";
  return "unknown";
}

export function checkAffiliateLink(rawUrl: string, expected?: AffiliatePlatform): AffiliateLinkCheck {
  const value = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      valid: false,
      platform: "unknown",
      normalizedUrl: value,
      host: "",
      linkStatus: "invalid",
      evidence: [],
      warning: "올바른 URL 형식이 아닙니다.",
    };
  }

  if (!(["http:", "https:"] as string[]).includes(parsed.protocol)) {
    return {
      valid: false,
      platform: "unknown",
      normalizedUrl: parsed.toString(),
      host: parsed.hostname,
      linkStatus: "invalid",
      evidence: [],
      warning: "HTTP 또는 HTTPS 링크만 등록할 수 있습니다.",
    };
  }

  parsed.hash = "";
  const platform = detectAffiliatePlatform(parsed);
  if (platform === "unknown" || (expected && platform !== expected)) {
    return {
      valid: false,
      platform,
      normalizedUrl: parsed.toString(),
      host: parsed.hostname,
      linkStatus: "invalid",
      evidence: [],
      warning: expected
        ? `${expected === "coupang" ? "쿠팡" : "Temu"} 도메인의 링크가 아닙니다.`
        : "지원하는 제휴 쇼핑몰 링크가 아닙니다.",
    };
  }

  const host = parsed.hostname.toLowerCase();
  const keys = new Set([...parsed.searchParams.keys()].map((key) => key.toLowerCase()));
  const evidence: string[] = [];

  if (platform === "coupang") {
    if (host === "coupa.ng" || host === "link.coupang.com") evidence.push("쿠팡 공유 링크 도메인");
    if (["lptag", "subid", "traceid", "pagekey"].some((key) => keys.has(key))) evidence.push("쿠팡 추적 파라미터");
  }

  if (platform === "temu") {
    if (host === "temu.to" || host.startsWith("share.")) evidence.push("Temu 공유 링크 도메인");
    if (["refer_page_id", "refer_page_sn", "refer_source", "aff_short_key", "subj"].some((key) => keys.has(key))) evidence.push("Temu 공유·제휴 파라미터");
  }

  return {
    valid: true,
    platform,
    normalizedUrl: parsed.toString(),
    host,
    linkStatus: evidence.length ? "verified" : "provider-link",
    evidence,
    warning: evidence.length
      ? undefined
      : "쇼핑몰 링크는 확인했지만 URL만으로 제휴 추적 여부를 확정할 수 없습니다. 반드시 해당 제휴 대시보드의 공유 기능으로 만든 링크를 사용하세요.",
  };
}
