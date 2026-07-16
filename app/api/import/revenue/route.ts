import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return NextResponse.json({ success: false, message: "매출 데이터가 없습니다." }, { status: 400 });
    const supabase = await createClient();
    const rows = items.map((item: Record<string, unknown>) => ({
      product_id: item.product_id || null,
      platform: String(item.platform || "etc"),
      order_id: String(item.order_id || ""),
      amount: Number(item.amount || 0),
      commission: Number(item.commission || 0),
      status: String(item.status || "confirmed"),
      occurred_at: String(item.occurred_at || new Date().toISOString()),
      raw_data: item,
    }));
    const { data, error } = await supabase.from("revenue_events").upsert(rows, { onConflict: "platform,order_id" }).select("id");
    if (error) throw error;
    return NextResponse.json({ success: true, count: data?.length || 0 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "매출 가져오기 실패" }, { status: 500 });
  }
}
