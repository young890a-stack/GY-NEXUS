import { NextResponse } from "next/server";
import { checkAffiliateLink } from "@/lib/affiliate/link-check";
import { recordAffiliateSyncFailure, saveAffiliateCandidates } from "@/lib/affiliate/save-candidates";
import type { AffiliateCandidate } from "@/lib/affiliate/types";
import { extractProductSource } from "@/lib/product-dna/metadata";

export const runtime = "nodejs";
export const maxDuration = 90;

type InputItem = {
  url?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  priceText?: string;
};

async function normalize(item: InputItem, rank: number): Promise<AffiliateCandidate> {
  const rawUrl = String(item.url || "").trim();
  const link = checkAffiliateLink(rawUrl, "temu");
  if (!link.valid) throw new Error(link.warning || "Temu 링크가 아닙니다.");

  const metadata = await extractProductSource(link.normalizedUrl);
  if (metadata.platform !== "temu") throw new Error("링크가 Temu 상품 페이지로 연결되지 않습니다.");
  const title = String(item.title || metadata.title || "").trim();
  if (!title) throw new Error("자동으로 상품명을 확인하지 못했습니다. 링크 뒤에 | 상품명을 함께 입력해주세요.");
  const description = String(item.description || metadata.description || "").trim();
  const imageUrl = String(item.imageUrl || metadata.imageUrl || "").trim();
  const priceText = String(item.priceText || metadata.priceText || "").trim();
  const completed = [title, description, imageUrl, priceText].filter(Boolean).length;
  const identitySource = `${metadata.resolvedUrl} ${link.normalizedUrl}`;
  const externalId = identitySource.match(/(?:-g-|goods[_-]?id[=/])([0-9]{8,})/i)?.[1] || "";

  return {
    platform: "temu",
    sourceMode: "temu-share-link",
    externalId,
    title: title.slice(0, 300),
    description: description.slice(0, 4000),
    imageUrl,
    affiliateUrl: link.normalizedUrl,
    resolvedUrl: metadata.resolvedUrl,
    priceText,
    category: "Temu 공유 상품",
    rank,
    dataQualityScore: Math.min(92, 48 + completed * 11 + (link.evidence.length ? 8 : 0)),
    linkStatus: link.linkStatus === "verified" ? "verified" : "provider-link",
    rawData: {
      metadataStatus: metadata.extractionStatus,
      metadataMethod: metadata.extractionMethod,
      linkEvidence: link.evidence,
      linkWarning: link.warning || null,
    },
  };
}

export async function POST(request: Request) {
  let requestedCount = 0;
  try {
    const body = await request.json() as { items?: InputItem[] };
    const items = Array.isArray(body.items) ? body.items.slice(0, 10) : [];
    requestedCount = items.length;
    if (!items.length) {
      return NextResponse.json({ success: false, message: "Temu 공유 링크를 한 개 이상 입력해주세요." }, { status: 400 });
    }

    const accepted: AffiliateCandidate[] = [];
    const rejected: Array<{ input: string; reason: string }> = [];
    for (let offset = 0; offset < items.length; offset += 3) {
      const chunk = items.slice(offset, offset + 3);
      const results = await Promise.allSettled(chunk.map((item, index) => normalize(item, offset + index + 1)));
      results.forEach((result, index) => {
        if (result.status === "fulfilled") accepted.push(result.value);
        else rejected.push({ input: String(chunk[index]?.url || "").slice(0, 300), reason: result.reason instanceof Error ? result.reason.message : "링크 확인 실패" });
      });
    }

    if (!accepted.length) {
      const reason = rejected[0]?.reason || "등록 가능한 Temu 링크가 없습니다.";
      await recordAffiliateSyncFailure({ provider: "temu", mode: "temu-share-link", sourceName: "temu_affiliate:share-links", requestedCount, message: reason });
      return NextResponse.json({ success: false, message: reason, rejected }, { status: 400 });
    }

    const saved = await saveAffiliateCandidates({
      provider: "temu",
      mode: "temu-share-link",
      sourceName: "temu_affiliate:share-links",
      items: accepted,
      requestedCount,
      rejected,
    });
    return NextResponse.json({
      success: true,
      imported: saved.length,
      rejected,
      items: saved,
      message: rejected.length
        ? `${saved.length}개를 저장했고 ${rejected.length}개는 이유를 표시해 제외했습니다.`
        : `Temu 공유 링크 ${saved.length}개를 검증·저장했습니다.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Temu 상품 저장에 실패했습니다.";
    await recordAffiliateSyncFailure({ provider: "temu", mode: "temu-share-link", sourceName: "temu_affiliate:share-links", requestedCount, message });
    return NextResponse.json({ success: false, message }, { status: /MIGRATION/i.test(message) ? 409 : 500 });
  }
}
