import type { ProductConfidence, ProductPlatform, ProductSource } from "./types";

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
];

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function pickMeta(html: string, keys: string[]) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeEntities(match[1].trim());
    }
  }
  return "";
}

function safeJsonLd(html: string) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const item of scripts) {
    try {
      const parsed = JSON.parse(item[1].trim());
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const node = queue.shift();
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node)) { queue.push(...node); continue; }
        if (node["@graph"]) queue.push(...(Array.isArray(node["@graph"]) ? node["@graph"] : [node["@graph"]]));
        const type = String(node["@type"] || "").toLowerCase();
        if (type.includes("product")) return node as Record<string, unknown>;
      }
    } catch {
      // Ignore malformed merchant JSON-LD.
    }
  }
  return null;
}

function asText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return asText(value[0]);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return asText(obj.url || obj.contentUrl || obj.name);
  }
  return "";
}

export function detectPlatform(host: string): ProductPlatform {
  const value = host.toLowerCase();
  if (value.includes("coupang")) return "coupang";
  if (value.includes("temu")) return "temu";
  if (value.includes("smartstore.naver") || value.includes("brand.naver")) return "naver-smartstore";
  if (value.includes("11st.co.kr")) return "11st";
  if (value.includes("aliexpress")) return "aliexpress";
  if (value.includes("amazon")) return "amazon";
  return "other";
}

function emptyConfidence(): ProductConfidence {
  return { title: 0, description: 0, image: 0, price: 0 };
}

export function createManualFallback(rawUrl: string, reason: string, resolvedUrl?: string): ProductSource {
  const input = new URL(rawUrl.trim());
  const finalUrl = resolvedUrl || input.toString();
  const host = (() => { try { return new URL(finalUrl).hostname; } catch { return input.hostname; } })();
  return {
    sourceUrl: input.toString(),
    resolvedUrl: finalUrl,
    platform: detectPlatform(host),
    title: "",
    description: "",
    imageUrl: "",
    priceText: "",
    currency: "",
    extractionStatus: "manual",
    extractionMethod: "manual",
    blockedReason: reason,
    confidence: emptyConfidence(),
  };
}

function validateUrl(rawUrl: string) {
  const input = new URL(rawUrl.trim());
  if (!["http:", "https:"].includes(input.protocol)) throw new Error("HTTP 또는 HTTPS 링크만 사용할 수 있습니다.");
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(input.hostname))) throw new Error("내부 네트워크 주소는 사용할 수 없습니다.");
  return input;
}

export async function extractProductSource(rawUrl: string): Promise<ProductSource> {
  const input = validateUrl(rawUrl);

  let response: Response;
  try {
    response = await fetch(input, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GY-NEXUS-ProductDNA/1.5; +https://gywealthlab.com)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    return createManualFallback(input.toString(), error instanceof Error ? error.message : "상품 페이지 연결 실패");
  }

  const resolvedUrl = response.url || input.toString();
  const resolved = new URL(resolvedUrl);
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(resolved.hostname))) throw new Error("안전하지 않은 리디렉션이 감지되었습니다.");

  if (!response.ok) {
    const reason = response.status === 403
      ? "쇼핑몰이 자동 상품 정보 읽기를 차단했습니다. 제휴링크는 유지되며 상품명·설명·이미지를 직접 보완해 계속 진행할 수 있습니다."
      : `상품 페이지가 HTTP ${response.status}를 반환했습니다. 직접 입력 모드로 전환합니다.`;
    return createManualFallback(input.toString(), reason, resolvedUrl);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return createManualFallback(input.toString(), "HTML 상품 페이지가 아닌 링크입니다. 직접 입력 모드로 전환합니다.", resolvedUrl);
  }

  const html = (await response.text()).slice(0, 2_000_000);
  const jsonLd = safeJsonLd(html);
  const offersRaw = jsonLd?.offers;
  const offers = Array.isArray(offersRaw) ? offersRaw[0] as Record<string, unknown> :
    offersRaw && typeof offersRaw === "object" ? offersRaw as Record<string, unknown> : null;
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
  const title = asText(jsonLd?.name) || pickMeta(html, ["og:title", "twitter:title"]) || decodeEntities(titleTag);
  const description = asText(jsonLd?.description) || pickMeta(html, ["og:description", "description", "twitter:description"]);
  const imageUrl = asText(jsonLd?.image) || pickMeta(html, ["og:image", "twitter:image"]);
  const price = asText(offers?.price) || pickMeta(html, ["product:price:amount", "og:price:amount"]);
  const currency = asText(offers?.priceCurrency) || pickMeta(html, ["product:price:currency", "og:price:currency"]);
  const confidence: ProductConfidence = {
    title: title ? 95 : 0,
    description: description ? 85 : 0,
    image: imageUrl ? 90 : 0,
    price: price ? 75 : 0,
  };

  return {
    sourceUrl: input.toString(),
    resolvedUrl,
    platform: detectPlatform(resolved.hostname),
    title,
    description,
    imageUrl,
    priceText: price ? `${price}${currency ? ` ${currency}` : ""}` : "",
    currency,
    extractionStatus: title && (description || imageUrl) ? "complete" : title ? "partial" : "manual",
    extractionMethod: title ? "metadata" : "redirect-only",
    blockedReason: title ? undefined : "공개 메타데이터가 없어 직접 입력이 필요합니다.",
    confidence,
  };
}
