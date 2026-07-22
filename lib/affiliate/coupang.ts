import crypto from "node:crypto";
import type { AffiliateCandidate, AffiliateSourceMode, CoupangDiscoveryMode } from "./types";

const API_ORIGIN = "https://api-gateway.coupang.com";
const API_PREFIX = "/v2/providers/affiliate_open_api/apis/openapi/v1";

type JsonObject = Record<string, unknown>;

export class CoupangPartnersError extends Error {
  constructor(message: string, public readonly status = 502, public readonly code = "COUPANG_API_ERROR") {
    super(message);
    this.name = "CoupangPartnersError";
  }
}

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function signedDate(date: Date) {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function credentials() {
  const accessKey = process.env.COUPANG_ACCESS_KEY?.trim();
  const secretKey = process.env.COUPANG_SECRET_KEY?.trim();
  if (!accessKey || !secretKey) {
    throw new CoupangPartnersError("쿠팡 파트너스 Access Key와 Secret Key가 필요합니다.", 400, "COUPANG_KEYS_MISSING");
  }
  return { accessKey, secretKey };
}

function authorization(method: string, path: string, query: string, accessKey: string, secretKey: string) {
  const date = signedDate(new Date());
  const message = `${date}${method}${path}${query}`;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${date}, signature=${signature}`;
}

async function request(path: string, params: URLSearchParams) {
  const { accessKey, secretKey } = credentials();
  const query = params.toString();
  const auth = authorization("GET", path, query, accessKey, secretKey);
  let response: Response | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(`${API_ORIGIN}${path}${query ? `?${query}` : ""}`, {
      method: "GET",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status !== 429 && response.status < 500) break;
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
  }

  if (!response) throw new CoupangPartnersError("쿠팡 API 응답을 받지 못했습니다.");
  const raw = await response.text();
  let payload: unknown = raw;
  try { payload = JSON.parse(raw); } catch {}
  const body = object(payload);
  const providerCode = text(body?.rCode || body?.code);
  const providerMessage = text(body?.rMessage || body?.message);

  if (!response.ok || (providerCode && providerCode !== "0")) {
    const reason = providerMessage || `HTTP ${response.status}`;
    throw new CoupangPartnersError(
      `쿠팡 파트너스 API 요청이 거절되었습니다: ${reason}`,
      response.status === 401 || response.status === 403 ? 403 : 502,
      providerCode || `HTTP_${response.status}`,
    );
  }
  return payload;
}

function findProductRows(payload: unknown) {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) {
      const rows = current.filter((item) => {
        const row = object(item);
        return Boolean(row && (row.productName || row.productUrl || row.productId));
      }) as JsonObject[];
      if (rows.length) return rows;
      queue.push(...current);
      continue;
    }
    const row = object(current);
    if (row) queue.push(...Object.values(row));
  }
  return [] as JsonObject[];
}

function priceText(value: unknown) {
  const amount = number(value);
  return amount > 0 ? `${Math.round(amount).toLocaleString("ko-KR")}원` : text(value);
}

function normalizeProducts(payload: unknown, mode: CoupangDiscoveryMode, category: string): AffiliateCandidate[] {
  const sourceMode: AffiliateSourceMode = mode === "goldbox" ? "coupang-goldbox" : mode === "category" ? "coupang-category" : "coupang-search";
  return findProductRows(payload).slice(0, 100).map((row, index) => {
    const affiliateUrl = text(row.productUrl || row.productLink || row.url);
    const title = text(row.productName || row.title || row.name);
    const imageUrl = text(row.productImage || row.imageUrl || row.image);
    const externalId = text(row.productId || row.itemId || row.id) || `${index + 1}`;
    const resolvedCategory = text(row.categoryName || row.category) || category;
    const completeness = [title, affiliateUrl, imageUrl, row.productPrice].filter(Boolean).length;
    return {
      platform: "coupang" as const,
      sourceMode,
      externalId,
      title,
      description: text(row.description),
      imageUrl,
      affiliateUrl,
      priceText: priceText(row.productPrice || row.price || row.salePrice),
      category: resolvedCategory,
      rank: index + 1,
      dataQualityScore: Math.min(98, 60 + completeness * 9),
      linkStatus: affiliateUrl ? "verified" as const : "unconfirmed" as const,
      rawData: row,
    };
  }).filter((item) => item.title && item.affiliateUrl);
}

export async function discoverCoupangProducts(input: {
  mode: CoupangDiscoveryMode;
  keyword?: string;
  categoryId?: string;
  categoryName?: string;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(100, Math.round(input.limit || 20)));
  const subId = process.env.COUPANG_SUB_ID?.trim();
  const params = new URLSearchParams();
  const imageSize = process.env.COUPANG_IMAGE_SIZE?.trim() || "512x512";
  let path: string;

  if (input.mode === "goldbox") {
    path = `${API_PREFIX}/products/goldbox`;
  } else if (input.mode === "category") {
    const categoryId = String(input.categoryId || "").trim();
    if (!/^\d{4}$/.test(categoryId)) throw new CoupangPartnersError("쿠팡 카테고리를 선택해주세요.", 400, "INVALID_CATEGORY");
    path = `${API_PREFIX}/products/bestcategories/${categoryId}`;
    params.set("limit", String(limit));
  } else {
    const keyword = String(input.keyword || "").trim();
    if (keyword.length < 2) throw new CoupangPartnersError("검색어를 두 글자 이상 입력해주세요.", 400, "INVALID_KEYWORD");
    path = `${API_PREFIX}/products/search`;
    params.set("keyword", keyword.slice(0, 100));
    params.set("limit", String(limit));
  }

  if (subId) params.set("subId", subId);
  params.set("imageSize", imageSize);
  const payload = await request(path, params);
  const items = normalizeProducts(payload, input.mode, input.categoryName || input.keyword || "");
  if (!items.length) {
    throw new CoupangPartnersError("쿠팡 API는 응답했지만 등록 가능한 상품이 없었습니다.", 502, "EMPTY_PRODUCTS");
  }
  return { items: items.slice(0, limit), payload };
}


export async function findCoupangProductById(productId: string) {
  const normalizedId = String(productId || "").trim();
  if (!/^\d+$/.test(normalizedId)) {
    throw new CoupangPartnersError("쿠팡 상품번호가 올바르지 않습니다.", 400, "INVALID_PRODUCT_ID");
  }

  const params = new URLSearchParams();
  params.set("keyword", normalizedId);
  params.set("limit", "10");
  params.set("imageSize", process.env.COUPANG_IMAGE_SIZE?.trim() || "512x512");
  params.set("srpLinkOnly", "false");
  const subId = process.env.COUPANG_SUB_ID?.trim();
  if (subId) params.set("subId", subId);

  const payload = await request(`${API_PREFIX}/products/search`, params);
  const items = normalizeProducts(payload, "search", normalizedId);
  const exact = items.find((item) => item.externalId === normalizedId);
  if (!exact) {
    throw new CoupangPartnersError(
      `쿠팡 API에서 상품번호 ${normalizedId}와 정확히 일치하는 상품을 찾지 못했습니다.`,
      404,
      "COUPANG_PRODUCT_NOT_FOUND",
    );
  }
  return exact;
}

export async function testCoupangConnection() {
  const result = await discoverCoupangProducts({ mode: "search", keyword: "노트북", limit: 1 });
  return result.items[0];
}
