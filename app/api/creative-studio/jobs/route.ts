import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export async function GET() {
  try {
    const { data, error } = await createAdminClient().from("creative_jobs").select("id,job_type,title,status,provider,asset_url,error_message,created_at,completed_at").order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    return NextResponse.json({ success: true, jobs: data || [] });
  } catch (error) { return NextResponse.json({ success: false, jobs: [], message: error instanceof Error ? error.message : "작업 이력을 불러오지 못했습니다." }, { status: 500 }); }
}
