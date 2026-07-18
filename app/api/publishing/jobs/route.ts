import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
const ALLOWED_CHANNELS = new Set(["youtube", "blogger", "naver", "wordpress", "webhook"]);
export async function GET() { try { const supabase = createAdminClient(); const { data, error } = await supabase.from("publishing_jobs").select("*").order("created_at", { ascending: false }).limit(200); if (error) throw error; return NextResponse.json({ success: true, jobs: data || [] }); } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "게시 작업 조회 실패" }, { status: 500 }); } }
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { channels?: string[]; channel?: string; title?: string; content?: string; scheduledAt?: string; payload?: Record<string, unknown>; aiContentId?: string };
    const channels = Array.from(new Set((body.channels?.length ? body.channels : [body.channel]).map((v) => String(v || "").trim()).filter(Boolean)));
    const title = String(body.title || "").trim(); const content = String(body.content || "").trim(); const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    if (!channels.length || channels.some((channel) => !ALLOWED_CHANNELS.has(channel))) return NextResponse.json({ success: false, message: "지원하지 않는 게시 채널이 포함되어 있습니다." }, { status: 400 });
    if (!title || !content) return NextResponse.json({ success: false, message: "제목과 본문을 입력해주세요." }, { status: 400 });
    if (Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ success: false, message: "예약 시간이 올바르지 않습니다." }, { status: 400 });
    const rows = channels.map((channel) => ({ ai_content_id: body.aiContentId || null, channel, title, content, status: "queued", scheduled_at: scheduledAt.toISOString(), payload: body.payload || {}, attempts: 0, max_attempts: 3 }));
    const supabase = createAdminClient(); const { data, error } = await supabase.from("publishing_jobs").insert(rows).select("*"); if (error) throw error;
    return NextResponse.json({ success: true, jobs: data || [] });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "게시 작업 생성 실패" }, { status: 500 }); }
}
export async function PATCH(request: NextRequest) { try { const body = (await request.json()) as { id?: string; action?: "retry" | "cancel" }; const id = String(body.id || "").trim(); if (!id) return NextResponse.json({ success: false, message: "작업 ID가 없습니다." }, { status: 400 }); const update = body.action === "retry" ? { status: "retry", last_error: null, scheduled_at: new Date().toISOString(), updated_at: new Date().toISOString() } : { status: "cancelled", updated_at: new Date().toISOString() }; const supabase = createAdminClient(); const { error } = await supabase.from("publishing_jobs").update(update).eq("id", id); if (error) throw error; return NextResponse.json({ success: true }); } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "게시 작업 변경 실패" }, { status: 500 }); } }
export async function DELETE(request: NextRequest) { try { const id = request.nextUrl.searchParams.get("id")?.trim(); if (!id) return NextResponse.json({ success: false, message: "작업 ID가 없습니다." }, { status: 400 }); const supabase = createAdminClient(); const { error } = await supabase.from("publishing_jobs").delete().eq("id", id); if (error) throw error; return NextResponse.json({ success: true }); } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "게시 작업 삭제 실패" }, { status: 500 }); } }
