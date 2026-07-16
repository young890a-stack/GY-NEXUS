import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateTrendScore } from "@/lib/automation/scoring";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return NextResponse.json({ success: false, message: "상품 데이터가 없습니다." }, { status: 400 });
    const supabase = await createClient();
    const rows = items.map((item: Record<string, unknown>, index: number) => ({
      title: String(item.title || "").trim(),
      description: String(item.description || ""),
      image_url: String(item.image_url || ""),
      affiliate_url: String(item.affiliate_url || ""),
      platform: String(item.platform || "etc"),
      price_text: String(item.price_text || ""),
      source_name: String(item.source_name || "manual"),
      external_rank: Number(item.external_rank || index + 1),
      external_score: Number(item.external_score || 0),
      trend_score: calculateTrendScore({ externalRank: Number(item.external_rank || index + 1), externalScore: Number(item.external_score || 0) }),
      raw_data: item,
    })).filter((row: { title: string; affiliate_url: string }) => row.title && row.affiliate_url);
    const { data, error } = await supabase.from("trend_products").upsert(rows, { onConflict: "source_name,affiliate_url" }).select("id");
    if (error) throw error;
    return NextResponse.json({ success: true, count: data?.length || 0 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "인기 상품 수집 실패" }, { status: 500 });
  }
}
