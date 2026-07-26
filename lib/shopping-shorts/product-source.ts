import type { ShoppingShortsProductInput } from "./types";

const MAX_HTML_BYTES = 2_500_000;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost"
    || host === "0.0.0.0"
    || host === "::1"
    || host.endsWith(".local")
    || host === "metadata.google.internal"
    || /^127\./.test(host)
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^169\.254\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

function safeUrl(value: string) {
  const url = new URL(value);
  if (!ALLOWED_PROTOCOLS.has(url.protocol) || isPrivateHostname(url.hostname)) {
    throw new Error("외부의 안전한 http 또는 https 상품 주소만 사용할 수 있습니다.");
  }
  url.username = "";
  url.password = "";
  return url;
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

function findProduct(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProduct(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const type = row["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return row;
  if (row["@graph"]) return findProduct(row["@graph"]);
  return null;
}

function parseProductJsonLd(html: string) {
  const scripts = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const script of scripts) {
    try {
      const product = findProduct(JSON.parse(script[1].replace(/^<!--|-->$/g, "").trim()));
      if (product) return product;
    } catch {
      // Some stores emit malformed JSON-LD. OpenGraph metadata is the fallback.
    }
  }
  return null;
}

function firstString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return firstString(row.url || row.contentUrl || row.image || row.src);
  }
  return "";
}

function reviewTexts(product: Record<string, unknown> | null) {
  if (!product) return [];
  const raw = Array.isArray(product.review) ? product.review : product.review ? [product.review] : [];
  return raw.map((review) => {
    if (typeof review === "string") return stripTags(review);
    if (!review || typeof review !== "object") return "";
    const row = review as Record<string, unknown>;
    return stripTags(String(row.reviewBody || row.description || row.name || ""));
  }).filter(Boolean).slice(0, 20);
}

async function fetchPage(initial: URL) {
  let current = initial;
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    if (isPrivateHostname(current.hostname)) throw new Error("안전하지 않은 리디렉션을 차단했습니다.");
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
        "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/124 Safari/537.36 GY-NEXUS/1.0",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      current = safeUrl(new URL(location, current).toString());
      continue;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return { html: "", finalUrl: current };
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_HTML_BYTES) throw new Error("상품 페이지가 너무 커서 자동 분석할 수 없습니다.");
    return { html: (await response.text()).slice(0, MAX_HTML_BYTES), finalUrl: current };
  }
  return { html: "", finalUrl: current };
}

function absoluteUrl(value: string, base: URL) {
  if (!value) return "";
  try {
    return safeUrl(new URL(value, base).toString()).toString();
  } catch {
    return "";
  }
}

export async function resolveShoppingProduct(input: ShoppingShortsProductInput) {
  const direct = {
    ...input,
    name: String(input.name || "").replace(/\s+/g, " ").trim(),
    description: String(input.description || "").replace(/\s+/g, " ").trim(),
    reviews: (input.reviews || []).map((item) => String(item).replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 30),
  };
  if (!input.url?.trim()) {
    if (!direct.name || direct.description.length < 10) {
      throw new Error("상품 URL 또는 상품명과 10자 이상의 확인된 상품 설명을 입력해주세요.");
    }
    return direct;
  }

  const requestedUrl = safeUrl(input.url.trim());
  const { html, finalUrl } = await fetchPage(requestedUrl);
  if (!html) {
    if (!direct.name || direct.description.length < 10) {
      throw new Error("판매 사이트가 자동 읽기를 차단했습니다. 상품명과 확인된 상품 설명을 함께 입력해주세요.");
    }
    return { ...direct, url: finalUrl.toString() };
  }

  const product = parseProductJsonLd(html);
  const titleTag = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const name = direct.name || stripTags(String(product?.name || "")) || metaContent(html, "og:title") || titleTag;
  const description = direct.description
    || stripTags(String(product?.description || ""))
    || metaContent(html, "og:description")
    || metaContent(html, "description");
  const image = direct.imageUrl
    || firstString(product?.image)
    || metaContent(html, "og:image")
    || metaContent(html, "twitter:image");
  const reviews = [...(direct.reviews || []), ...reviewTexts(product)].slice(0, 30);
  if (!name || description.length < 10) {
    throw new Error("페이지에서 믿을 수 있는 상품 정보를 찾지 못했습니다. 상품명과 확인된 설명을 직접 보완해주세요.");
  }
  return {
    ...direct,
    url: finalUrl.toString(),
    name: name.slice(0, 240),
    description: description.slice(0, 4000),
    imageUrl: absoluteUrl(image, finalUrl),
    reviews,
  };
}

