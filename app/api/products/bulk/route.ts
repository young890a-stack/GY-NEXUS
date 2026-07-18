import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((v) => v.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export async function POST(request: Request) {
  try {
    const { csv } = await request.json();
    const rows = parseCsv(String(csv || "")).filter((row) => row.title && row.affiliate_url);
    if (!rows.length) return NextResponse.json({ message: "등록할 상품이 없습니다." }, { status: 400 });
    const supabase = createAdminClient();
    const { error } = await supabase.from("products").insert(rows);
    if (error) throw error;
    return NextResponse.json({ count: rows.length });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "일괄 등록 실패" }, { status: 500 });
  }
}
