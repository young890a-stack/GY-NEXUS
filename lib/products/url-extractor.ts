export type ExtractedProduct = {
  sourceUrl: string;
  finalUrl: string;
  platform: "coupang" | "temu" | "naver" | "amazon" | "etc";
  title: string;
  description: string;
  imageUrl: string;
  priceText: string;
  brand: string;
  category: string;
  evidence: string[];
};

const MAX_HTML_BYTES = 1_500_000;
const REQUEST_TIMEOUT_MS = 12_000;

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, key: string) {
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

function titleTag(html: string) {
  const value = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return decodeHtml(value.replace(/<[^>]+>/g, ""));
}

function jsonLdProducts(html: string): Record<string, unknown>[] {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const products: Record<string, unknown>[] = [];

  function visit(value: unknown) {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    const type = object["@type"];
    if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) products.push(object);
    if (object["@graph"]) visit(object["@graph"]);
    if (object.itemListElement) visit(object.itemListElement);
    if (object.item) visit(object.item);
  }

  for (const script of scripts.slice(0, 20)) {
    try {
      visit(JSON.parse(script[1].trim()));
    } catch {
      // 일부 쇼핑몰의 잘못된 JSON-LD는 무시하고 Open Graph 정보로 계속 진행합니다.
    }
  }
  return products;
}

function asText(value: unknown) {
  if (typeof value === "string") return decodeHtml(value.replace(/<[^>]+>/g, " "));
  if (typeof value === "number") return String(value);
  return "";
}

function imageFrom(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return imageFrom(value[0]);
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return asText(object.url || object.contentUrl);
  }
  return "";
}

function priceFrom(product: Record<string, unknown>) {
  const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  if (!offers || typeof offers !== "object") return "";
  const object = offers as Record<string, unknown>;
  const price = asText(object.price || object.lowPrice || object.highPrice);
  const currency = asText(object.priceCurrency);
  if (!price) return "";
  if (currency === "KRW") return `${Number(price).toLocaleString("ko-KR")}원`;
  return currency ? `${price} ${currency}` : price;
}

function detectPlatform(hostname: string): ExtractedProduct["platform"] {
  const host = hostname.toLowerCase();
  if (host.includes("coupang.com")) return "coupang";
  if (host.includes("temu.com")) return "temu";
  if (host.includes("naver.com")) return "naver";
  if (host.includes("amazon.")) return "amazon";
  return "etc";
}

function assertSafeHttpUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("올바른 상품 URL을 입력해주세요.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("http 또는 https 상품 URL만 사용할 수 있습니다.");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("내부 네트워크 주소는 분석할 수 없습니다.");
  }
  return url;
}

async function readLimitedHtml(response: Response) {
  if (!response.body) return await response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let html = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      break;
    }
    html += decoder.decode(value, { stream: true });
  }
  html += decoder.decode();
  return html;
}

export async function extractProductFromUrl(rawUrl: string): Promise<ExtractedProduct> {
  const url = assertSafeHttpUrl(rawUrl.trim());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GY-NEXUS/5.3; +product-analysis)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      },
    });

    if (!response.ok) throw new Error(`상품 페이지를 불러오지 못했습니다. HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("HTML 상품 페이지가 아닙니다.");
    }

    const finalUrl = assertSafeHttpUrl(response.url || url.toString());
    const html = await readLimitedHtml(response);
    const product = jsonLdProducts(html)[0] || {};
    const brandValue = product.brand;
    const brand = typeof brandValue === "object" && brandValue
      ? asText((brandValue as Record<string, unknown>).name)
      : asText(brandValue);

    const title =
      asText(product.name) ||
      meta(html, "og:title") ||
      meta(html, "twitter:title") ||
      titleTag(html);
    const description =
      asText(product.description) ||
      meta(html, "og:description") ||
      meta(html, "description") ||
      meta(html, "twitter:description");
    const imageUrl =
      imageFrom(product.image) ||
      meta(html, "og:image") ||
      meta(html, "twitter:image");
    const priceText =
      priceFrom(product) ||
      meta(html, "product:price:amount") ||
      meta(html, "og:price:amount");
    const category = asText(product.category);

    if (!title) {
      throw new Error("상품명을 자동 추출하지 못했습니다. 아래 수동 입력 모드에서 상품명을 추가해주세요.");
    }

    const evidence = [
      title ? "상품명" : "",
      description ? "설명" : "",
      imageUrl ? "이미지" : "",
      priceText ? "가격" : "",
      brand ? "브랜드" : "",
      category ? "카테고리" : "",
    ].filter(Boolean);

    return {
      sourceUrl: rawUrl.trim(),
      finalUrl: finalUrl.toString(),
      platform: detectPlatform(finalUrl.hostname),
      title: title.slice(0, 300),
      description: description.slice(0, 4000),
      imageUrl,
      priceText,
      brand,
      category,
      evidence,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("상품 페이지 응답 시간이 초과되었습니다. 수동 입력 모드를 이용해주세요.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
