import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const [coupangCandidates, temuCandidates, approvedCoupang, approvedTemu, lastRun] = await Promise.all([
      supabase.from("trend_products").select("id", { count: "exact", head: true }).eq("platform", "coupang"),
      supabase.from("trend_products").select("id", { count: "exact", head: true }).eq("platform", "temu"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("platform", "coupang"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("platform", "temu"),
      supabase.from("affiliate_sync_runs").select("provider,mode,status,accepted_count,rejected_count,finished_at,error_summary").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return NextResponse.json({
      success: true,
      providers: {
        coupang: { configured: Boolean(process.env.COUPANG_ACCESS_KEY?.trim() && process.env.COUPANG_SECRET_KEY?.trim()), candidates: coupangCandidates.count || 0, approved: approvedCoupang.count || 0 },
        temu: { configured: Boolean(process.env.TEMU_AFFILIATE_ID?.trim() || (temuCandidates.count || 0) > 0), candidates: temuCandidates.count || 0, approved: approvedTemu.count || 0 },
      },
      lastRun: lastRun.data || null,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "상품 연동 현황을 불러오지 못했습니다." }, { status: 500 });
  }
}
