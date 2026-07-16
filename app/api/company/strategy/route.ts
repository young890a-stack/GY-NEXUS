import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { runCompanyBrain } from "@/lib/dream-y/company-brain";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { command } = await request.json() as { command?: string };
    if (!command?.trim()) return NextResponse.json({ success: false, message: "대표 명령을 입력해주세요." }, { status: 400 });
    let memories: string[] = [];
    if (hasSupabaseEnv()) {
      const supabase = await createClient();
      const { data } = await supabase.from("company_memories").select("category,key,value").eq("is_active", true).order("priority", { ascending: false }).limit(30);
      memories = (data || []).map(row => `${row.category}.${row.key}=${row.value}`);
    }
    const result = await runCompanyBrain(command.trim(), memories);
    let meetingId: string | null = null;
    if (hasSupabaseEnv()) {
      const supabase = await createClient();
      const { data } = await supabase.from("strategy_meetings").insert({ command: command.trim(), objective: result.objective, decision: result.decision, confidence: result.confidence, agent_opinions: result.agentOpinions, missions: result.missions, risks: result.risks, success_metrics: result.successMetrics, status: "planned" }).select("id").single();
      meetingId = data?.id || null;
    }
    return NextResponse.json({ success: true, meetingId, result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "AI 회의 중 오류가 발생했습니다." }, { status: 500 });
  }
}
