import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(request: Request) {
  try {
    const runId = new URL(request.url).searchParams.get("runId")?.trim();
    if (!runId) return NextResponse.json({ success: false, message: "runId가 필요합니다." }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("china_collector_sessions_v3")
      .select("id,run_id,status,target_candidate_count,collected_candidate_count,last_platform,last_keyword,last_seen_at,expires_at,created_at")
      .eq("run_id", runId).order("created_at", { ascending: false }).limit(5);
    if (error) throw error;
    return NextResponse.json({ success: true, sessions: data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "수집 세션을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const runId = String(body.runId || "").trim();
    if (!runId) return NextResponse.json({ success: false, message: "수집 작업을 먼저 선택해주세요." }, { status: 400 });
    const supabase = createAdminClient();
    const { data: run, error: runError } = await supabase.from("china_discovery_runs")
      .select("id,target_candidate_count,collected_candidate_count").eq("id", runId).single();
    if (runError || !run) throw runError || new Error("수집 작업을 찾지 못했습니다.");
    await supabase.from("china_collector_sessions_v3").update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("run_id", runId).eq("status", "active");
    const token = `gyc_${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("china_collector_sessions_v3").insert({
      run_id: runId,
      token_hash: tokenHash(token),
      target_candidate_count: run.target_candidate_count,
      collected_candidate_count: run.collected_candidate_count || 0,
      expires_at: expiresAt,
    }).select("id,run_id,status,target_candidate_count,collected_candidate_count,expires_at").single();
    if (error) throw error;
    await supabase.from("china_discovery_runs").update({ collector_status: "ready", updated_at: new Date().toISOString() }).eq("id", runId);
    return NextResponse.json({ success: true, session: data, collectorToken: token });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "수집 세션을 만들지 못했습니다." }, { status: 500 });
  }
}
