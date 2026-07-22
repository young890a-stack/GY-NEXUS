import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth/owner";
import { buildStoragePath, uploadBuffer } from "@/lib/creative-studio/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 45;

type ImportedProduct = {
  name: string;
  description: string;
  imageUrl: string;
  originalImageUrl?: string;
  imageStored: boolean;
  imageSource: "storage" | "remote" | "none";
  priceText: string;
  discountText: string;
  platform: string;
  finalUrl: string;
  resolvedUrl: string;
  source: "database" | "page-metadata" | "link-only";
  warning?: string;
};

type PersistedImage = {
  imageUrl: string;
  originalImageUrl: string;
  imageStored: boolean;
  imageSource: ImportedProduct["imageSource"];
  warning?: string;
};

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_HTML_BYTES = 2_500_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
] as const);

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
    .replace(/\\u002[fF]/g, "/")
    .replace(/\\\//g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

function tagAttribute(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quoted = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  if (quoted) return decodeHtml(quoted);
  return decodeHtml(tag.match(new RegExp(`\\b${escaped}\\s*=\\s*([^\\s>]+)`, "i"))?.[1] || "");
}

function titleText(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return stripTags(title);
}

function absoluteUrl(value: string, base: URL) {
  if (!value) return "";
  try {
    const url = new URL(decodeHtml(value), base);
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

function numericPrice(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatPrice(value: string, currency = "KRW") {
  const number = numericPrice(value);
  if (!number) return value.trim();
  return currency.toUpperCase() === "KRW"
    ? `${Math.round(number).toLocaleString("ko-KR")}원`
    : `${currency.toUpperCase()} ${number.toLocaleString("ko-KR")}`;
}

function offerPrice(product: Record<string, unknown> | null) {
  if (!product) return "";
  const offersRaw = product.offers;
  const offers = Array.isArray(offersRaw) ? offersRaw[0] : offersRaw;
  if (!offers || typeof offers !== "object") return "";
  const offer = offers as Record<string, unknown>;
  const price = String(offer.price || offer.lowPrice || "").trim();
  const currency = String(offer.priceCurrency || "KRW").trim();
  return price ? formatPrice(price, currency) : "";
}

function discountText(html: string, priceText: string) {
  const explicit = metaContent(html, "product:discount")
    || metaContent(html, "product:discount:amount")
    || metaContent(html, "discount");
  if (explicit) return explicit.includes("%") ? explicit : `${explicit}%`;
  const original = metaContent(html, "product:original_price:amount")
    || metaContent(html, "product:original_price")
    || metaContent(html, "og:original_price:amount");
  const originalNumber = numericPrice(original);
  const saleNumber = numericPrice(priceText);
  if (!originalNumber || !saleNumber || saleNumber >= originalNumber) return "";
  return `${Math.round((1 - saleNumber / originalNumber) * 100)}%`;
}

function platformFor(url: URL) {
  const host = url.hostname.toLowerCase();
  if (host.includes("coupang")) return "coupang";
  if (host.includes("temu")) return "temu";
  if (host.includes("naver")) return "naver";
  if (host.includes("aliexpress")) return "aliexpress";
  return host.replace(/^www\./, "").split(".")[0] || "etc";
}

function imageCandidates(html: string, product: Record<string, unknown> | null, base: URL) {
  const candidates: Array<{ value: string; score: number }> = [];
  const add = (value: string, score: number) => {
    const absolute = absoluteUrl(value, base);
    if (!absolute || /\.(?:svg|ico)(?:$|[?#])/i.test(absolute)) return;
    candidates.push({ value: absolute, score });
  };

  add(firstString(product?.image), 100);
  add(metaContent(html, "og:image:secure_url"), 98);
  add(metaContent(html, "og:image"), 96);
  add(metaContent(html, "twitter:image:src"), 94);
  add(metaContent(html, "twitter:image"), 92);
  add(metaContent(html, "image"), 88);

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (/\brel\s*=\s*["'][^"']*(?:image_src|preload)[^"']*["']/i.test(tag)) {
      add(tagAttribute(tag, "href"), /image_src/i.test(tag) ? 90 : 65);
    }
  }

  const jsonImagePattern = /["'](?:imageUrl|image_url|productImage|product_image|originImage|representativeImage|thumbnailUrl|imagePath)["']\s*:\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(jsonImagePattern)) add(match[1] || "", 84);

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const descriptor = `${tagAttribute(tag, "id")} ${tagAttribute(tag, "class")} ${tagAttribute(tag, "alt")}`.toLowerCase();
    let score = 35;
    if (/(?:product|goods|item|main|representative|detail|thumbnail|gallery)/.test(descriptor)) score += 35;
    if (/(?:logo|icon|avatar|badge|banner|sprite|loading|placeholder)/.test(descriptor)) score -= 40;
    const width = Number(tagAttribute(tag, "width")) || 0;
    const height = Number(tagAttribute(tag, "height")) || 0;
    if (width >= 300 || height >= 300) score += 15;
    const srcset = tagAttribute(tag, "srcset").split(",").pop()?.trim().split(/\s+/)[0] || "";
    add(tagAttribute(tag, "data-origin") || tagAttribute(tag, "data-original") || tagAttribute(tag, "data-src") || srcset || tagAttribute(tag, "src"), score);
  }

  return Array.from(new Map(candidates.sort((a, b) => b.score - a.score).map((row) => [row.value, row])).values()).map((row) => row.value);
}

async function fetchProductPage(initial: URL) {
  let current = initial;
  for (let redirect = 0; redirect <= 6; redirect += 1) {
    if (isPrivateHostname(current.hostname)) throw new Error("안전하지 않은 리디렉션이 감지됐습니다.");
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36 GY-NEXUS-Product-Import/2.0",
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

function pageProduct(html: string, requestedUrl: URL, resolvedUrl: URL): ImportedProduct {
  const jsonLd = productJsonLd(html);
  const name = String(jsonLd?.name || "").trim()
    || metaContent(html, "og:title")
    || metaContent(html, "twitter:title")
    || titleText(html);
  const description = stripTags(String(jsonLd?.description || ""))
    || metaContent(html, "og:description")
    || metaContent(html, "description")
    || metaContent(html, "twitter:description");
  const images = imageCandidates(html, jsonLd, resolvedUrl);
  const price = offerPrice(jsonLd)
    || formatPrice(metaContent(html, "product:price:amount") || metaContent(html, "og:price:amount"));

  return {
    name: name.slice(0, 240),
    description: description.slice(0, 1800),
    imageUrl: images[0] || "",
    originalImageUrl: images[0] || "",
    imageStored: false,
    imageSource: images[0] ? "remote" : "none",
    priceText: price.slice(0, 80),
    discountText: discountText(html, price).slice(0, 40),
    platform: platformFor(resolvedUrl),
    finalUrl: requestedUrl.toString(),
    resolvedUrl: resolvedUrl.toString(),
    source: name || description || images.length ? "page-metadata" : "link-only",
    ...(name || description || images.length
      ? {}
      : { warning: "판매 사이트가 자동 읽기를 제한했습니다. 제휴링크는 그대로 보존했으며 상품명과 이미지는 직접 입력하거나 AI 이미지로 보완해주세요." }),
  };
}

function extensionFor(contentType: string, url: URL) {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  const direct = IMAGE_TYPES.get(normalized as "image/jpeg" | "image/png" | "image/webp");
  if (direct) return { extension: direct, contentType: normalized } as const;
  const pathname = url.pathname.toLowerCase();
  if (/\.jpe?g$/.test(pathname)) return { extension: "jpg", contentType: "image/jpeg" } as const;
  if (/\.png$/.test(pathname)) return { extension: "png", contentType: "image/png" } as const;
  if (/\.webp$/.test(pathname)) return { extension: "webp", contentType: "image/webp" } as const;
  return null;
}

async function downloadImage(initial: URL, referer: URL) {
  let current = initial;
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    if (isPrivateHostname(current.hostname)) throw new Error("안전하지 않은 이미지 주소입니다.");
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: referer.toString(),
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36 GY-NEXUS-Image-Import/2.0",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("이미지 리디렉션 주소가 없습니다.");
      current = safeExternalUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`상품 이미지 응답 ${response.status}`);
    const fileType = extensionFor(response.headers.get("content-type") || "", current);
    if (!fileType) throw new Error("JPG, PNG, WEBP 상품 이미지만 자동 저장할 수 있습니다.");
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_IMAGE_BYTES) throw new Error("상품 이미지가 12MB를 초과합니다.");
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength < 1 || arrayBuffer.byteLength > MAX_IMAGE_BYTES) throw new Error("상품 이미지 크기를 확인할 수 없습니다.");
    return { buffer: Buffer.from(arrayBuffer), finalUrl: current, ...fileType };
  }
  throw new Error("상품 이미지 리디렉션이 너무 많습니다.");
}

function isStoredAsset(url: string) {
  return /\/storage\/v1\/object\/public\//i.test(url) || /supabase\.(?:co|in)\/storage/i.test(url);
}

function mergeWarning(...values: Array<string | undefined>) {
  return values.map((value) => String(value || "").trim()).filter(Boolean).join(" ");
}

async function persistProductImage(params: {
  imageUrl: string;
  productName: string;
  platform: string;
  referer: URL;
}): Promise<PersistedImage> {
  const original = params.imageUrl.trim();
  if (!original) {
    return { imageUrl: "", originalImageUrl: "", imageStored: false, imageSource: "none" };
  }
  if (isStoredAsset(original)) {
    return { imageUrl: original, originalImageUrl: original, imageStored: true, imageSource: "storage" };
  }

  try {
    const remoteUrl = safeExternalUrl(original);
    const downloaded = await downloadImage(remoteUrl, params.referer);
    const path = buildStoragePath({
      folder: "references",
      title: `affiliate-${params.platform}-${params.productName || "product"}`,
      extension: downloaded.extension,
    });
    const storedUrl = await uploadBuffer({
      buffer: downloaded.buffer,
      path,
      contentType: downloaded.contentType,
    });
    return {
      imageUrl: storedUrl,
      originalImageUrl: downloaded.finalUrl.toString(),
      imageStored: true,
      imageSource: "storage",
    };
  } catch (error) {
    return {
      imageUrl: original,
      originalImageUrl: original,
      imageStored: false,
      imageSource: "remote",
      warning: `상품 이미지는 찾았지만 저장소 복사에 실패했습니다. 직접 이미지 업로드 또는 AI 상품 이미지 생성을 사용해주세요. (${error instanceof Error ? error.message : "이미지 저장 실패"})`,
    };
  }
}

async function withPersistedImage(product: ImportedProduct, referer: URL) {
  const persisted = await persistProductImage({
    imageUrl: product.imageUrl,
    productName: product.name,
    platform: product.platform,
    referer,
  });
  return {
    ...product,
    ...persisted,
    warning: mergeWarning(product.warning, persisted.warning) || undefined,
  } satisfies ImportedProduct;
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
      const databaseProduct: ImportedProduct = {
        name: String(exactProduct.title || ""),
        description: String(exactProduct.description || ""),
        imageUrl: String(exactProduct.image_url || ""),
        originalImageUrl: String(exactProduct.image_url || ""),
        imageStored: false,
        imageSource: exactProduct.image_url ? "remote" : "none",
        priceText: String(exactProduct.price_text || ""),
        discountText: "",
        platform: String(exactProduct.platform || platformFor(requestedUrl)),
        finalUrl: String(exactProduct.affiliate_url || requestedUrl.toString()),
        resolvedUrl: requestedUrl.toString(),
        source: "database",
        ...(!exactProduct.image_url ? { warning: "저장된 상품에 대표 이미지가 없습니다. 직접 이미지 업로드 또는 AI 상품 이미지 생성을 사용해주세요." } : {}),
      };
      return NextResponse.json({ success: true, product: await withPersistedImage(databaseProduct, requestedUrl) });
    }

    const fetched = await fetchProductPage(requestedUrl);
    let product = pageProduct(fetched.html, requestedUrl, fetched.finalUrl);
    product = await withPersistedImage(product, fetched.finalUrl);
    if (!fetched.response.ok && product.source === "link-only") {
      product.warning = mergeWarning(product.warning, `판매 페이지 응답 ${fetched.response.status}: 제휴링크는 보존했지만 상품 정보는 직접 입력해주세요.`);
    }
    if (!product.imageUrl) {
      product.warning = mergeWarning(product.warning, "대표 이미지를 찾지 못했습니다. 직접 이미지 업로드 또는 AI 상품 이미지 생성으로 계속할 수 있습니다.");
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "상품 정보를 불러오지 못했습니다.",
    }, { status: 500 });
  }
}
