import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("content_factory_runs").select("id,product_title,input_data,output_data,status,created_at").order("created_at", { ascending: false }).limit(12);
    if (error) throw error;
    return NextResponse.json({ success: true, runs: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, runs: [], message: error instanceof Error ? error.message : "이력을 불러오지 못했습니다." });
  }
}
