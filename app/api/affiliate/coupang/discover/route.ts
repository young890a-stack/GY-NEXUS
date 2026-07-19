import { NextResponse } from "next/server";
import { CoupangPartnersError, discoverCoupangProducts } from "@/lib/affiliate/coupang";
import { recordAffiliateSyncFailure, saveAffiliateCandidates } from "@/lib/affiliate/save-candidates";
import type { CoupangDiscoveryMode } from "@/lib/affiliate/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const categories: Record<string, string> = {
  "1001": "여성패션", "1002": "남성패션", "1010": "뷰티", "1011": "출산·유아동",
  "1012": "식품", "1013": "주방용품", "1014": "생활용품", "1015": "홈인테리어",
  "1016": "가전디지털", "1017": "스포츠·레저", "1018": "자동차용품", "1019": "도서·음반",
  "1020": "완구·취미", "1021": "문구·오피스", "1024": "헬스·건강식품", "1029": "반려동물용품",
};

export async function POST(request: Request) {
  let sourceName = "coupang_api";
  let requestedCount = 0;
  try {
    const body = await request.json() as { mode?: CoupangDiscoveryMode; keyword?: string; categoryId?: string; limit?: number };
    const mode = body.mode;
    if (!mode || !(["goldbox", "category", "search"] as string[]).includes(mode)) {
      return NextResponse.json({ success: false, message: "수집 방식을 선택해주세요." }, { status: 400 });
    }
    requestedCount = Math.max(1, Math.min(100, Math.round(Number(body.limit) || 20)));
    const categoryId = String(body.categoryId || "").trim();
    const keyword = String(body.keyword || "").trim();
    sourceName = mode === "goldbox"
      ? "coupang_api:goldbox"
      : mode === "category"
        ? `coupang_api:category:${categoryId}`
        : `coupang_api:search:${keyword.toLowerCase().slice(0, 60)}`;

    const { items } = await discoverCoupangProducts({
      mode,
      categoryId,
      categoryName: categories[categoryId],
      keyword,
      limit: requestedCount,
    });
    const sourceMode = mode === "goldbox" ? "coupang-goldbox" : mode === "category" ? "coupang-category" : "coupang-search";
    const saved = await saveAffiliateCandidates({
      provider: "coupang",
      mode: sourceMode,
      sourceName,
      items,
      requestedCount,
    });

    return NextResponse.json({
      success: true,
      imported: saved.length,
      sourceName,
      items: saved,
      message: `쿠팡에서 ${saved.length}개 상품을 실제로 불러와 중복 정리와 기회점수 계산을 완료했습니다.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "쿠팡 상품 수집에 실패했습니다.";
    await recordAffiliateSyncFailure({
      provider: "coupang",
      mode: sourceName.includes("goldbox") ? "coupang-goldbox" : sourceName.includes("category") ? "coupang-category" : "coupang-search",
      sourceName,
      requestedCount,
      message,
    });
    const status = error instanceof CoupangPartnersError ? error.status : /MIGRATION/i.test(message) ? 409 : 500;
    return NextResponse.json({ success: false, message, code: error instanceof CoupangPartnersError ? error.code : "IMPORT_FAILED" }, { status });
  }
}
