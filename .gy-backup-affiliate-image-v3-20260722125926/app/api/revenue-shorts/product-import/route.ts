import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type ImportedProduct = {
  name: string;
  description: string;
  imageUrl: string;
  priceText: string;
  platform: string;
  finalUrl: string;
  source: "database" | "page-metadata" | "link-only";
  warning?: string;
};

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_HTML_BYTES = 2_500_000;

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

function safeExternalUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("제휴링크를 입력해주세요.");
  const url = new URL(raw);
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new Error("http 또는 https 제휴링크만 사용할 수 있습니다.");
  if (isPrivateHostname(url.hostname)) throw new Error("내부 네트워크 주소는 사용할 수 없습니다.");
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
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
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

function titleText(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return stripTags(title);
}

function absoluteUrl(value: string, base: URL) {
  if (!value) return "";
  try {
    const url = new URL(value, base);
    if (!ALLOWED_PROTOCOLS.has(url.protocol) || isPrivateHostname(url.hostname)) return "";
    return url.toString();
  } catch {
    return "";
  }
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

function findProductJsonLd(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProductJsonLd(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const type = row["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return row;
  if (row["@graph"]) return findProductJsonLd(row["@graph"]);
  for (const child of Object.values(row)) {
    const found = findProductJsonLd(child);
    if (found) return found;
  }
  return null;
}

function productJsonLd(html: string) {
  const scripts = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const script of scripts) {
    const raw = script[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw.replace(/^<!--|-->$/g, "").trim()) as unknown;
      const product = findProductJsonLd(parsed);
      if (product) return product;
    } catch {
      continue;
    }
  }
  return null;
}

function offerPrice(product: Record<string, unknown> | null) {
  if (!product) return "";
  const offersRaw = product.offers;
  const offers = Array.isArray(offersRaw) ? offersRaw[0] : offersRaw;
  if (!offers || typeof offers !== "object") return "";
  const offer = offers as Record<string, unknown>;
  const price = String(offer.price || offer.lowPrice || "").trim();
  const currency = String(offer.priceCurrency || "").trim().toUpperCase();
  if (!price) return "";
  const number = Number(String(price).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(number)) return price;
  if (currency === "KRW" || !currency) return `${Math.round(number).toLocaleString("ko-KR")}원`;
  return `${currency} ${number.toLocaleString("ko-KR")}`;
}

function platformFor(url: URL) {
  const host = url.hostname.toLowerCase();
  if (host.includes("coupang")) return "coupang";
  if (host.includes("temu")) return "temu";
  if (host.includes("naver")) return "naver";
  if (host.includes("aliexpress")) return "aliexpress";
  return host.replace(/^www\./, "").split(".")[0] || "etc";
}

async function fetchProductPage(initial: URL) {
  let current = initial;
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    if (isPrivateHostname(current.hostname)) throw new Error("안전하지 않은 리디렉션이 감지됐습니다.");
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36 GY-NEXUS-Product-Import/1.0",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, finalUrl: current, html: "" };
      current = safeExternalUrl(new URL(location, current).toString());
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return { response, finalUrl: current, html: "" };
    }

    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_HTML_BYTES) throw new Error("상품 페이지가 너무 커서 자동 분석할 수 없습니다.");
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return { response, finalUrl: current, html };
  }
  throw new Error("제휴링크 리디렉션이 너무 많습니다.");
}

function pageProduct(html: string, finalUrl: URL): ImportedProduct {
  const jsonLd = productJsonLd(html);
  const name = String(jsonLd?.name || "").trim()
    || metaContent(html, "og:title")
    || metaContent(html, "twitter:title")
    || titleText(html);
  const description = stripTags(String(jsonLd?.description || ""))
    || metaContent(html, "og:description")
    || metaContent(html, "description")
    || metaContent(html, "twitter:description");
  const image = firstString(jsonLd?.image)
    || metaContent(html, "og:image")
    || metaContent(html, "twitter:image");
  const price = offerPrice(jsonLd)
    || metaContent(html, "product:price:amount")
    || metaContent(html, "og:price:amount");

  return {
    name: name.slice(0, 240),
    description: description.slice(0, 1800),
    imageUrl: absoluteUrl(image, finalUrl),
    priceText: price.slice(0, 80),
    platform: platformFor(finalUrl),
    finalUrl: finalUrl.toString(),
    source: name || description || image ? "page-metadata" : "link-only",
    ...(name || description || image
      ? {}
      : { warning: "판매 사이트가 자동 읽기를 제한해 링크만 확인했습니다. 상품명과 설명을 직접 입력하면 나머지 과정은 계속됩니다." }),
  };
}

export async function POST(request: Request) {
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!isOwner(user)) {
      return NextResponse.json({ success: false, message: "대표 관리자만 상품 자동수집을 사용할 수 있습니다." }, { status: 403 });
    }

    const body = await request.json() as { url?: unknown };
    const requestedUrl = safeExternalUrl(body.url);

    const admin = createAdminClient();
    const { data: exactProduct } = await admin
      .from("products")
      .select("title,description,image_url,affiliate_url,platform,price_text")
      .eq("affiliate_url", requestedUrl.toString())
      .maybeSingle();

    if (exactProduct) {
      return NextResponse.json({
        success: true,
        product: {
          name: String(exactProduct.title || ""),
          description: String(exactProduct.description || ""),
          imageUrl: String(exactProduct.image_url || ""),
          priceText: String(exactProduct.price_text || ""),
          platform: String(exactProduct.platform || platformFor(requestedUrl)),
          finalUrl: String(exactProduct.affiliate_url || requestedUrl.toString()),
          source: "database",
        } satisfies ImportedProduct,
      });
    }

    const fetched = await fetchProductPage(requestedUrl);
    const product = pageProduct(fetched.html, fetched.finalUrl);
    if (!fetched.response.ok && product.source === "link-only") {
      product.warning = `판매 페이지 응답 ${fetched.response.status}: 링크는 저장했지만 상품 정보는 직접 입력해주세요.`;
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "상품 정보를 불러오지 못했습니다.",
    }, { status: 500 });
  }
}
