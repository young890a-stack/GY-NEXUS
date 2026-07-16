import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("content_schedules").select("id,title,channel,scheduled_at,status").order("scheduled_at", { ascending: true });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request: Request) {
  const { title, channel, scheduledAt } = await request.json();
  if (!title || !scheduledAt) return NextResponse.json({ message: "제목과 예약 일시를 입력하세요." }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("content_schedules").insert({ title, channel, scheduled_at: new Date(scheduledAt).toISOString(), status: "scheduled" });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
