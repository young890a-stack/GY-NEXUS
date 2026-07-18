import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const email = String(payload.email || "").trim();
    const subject = String(payload.subject || "").trim();
    const body = String(payload.body || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !subject || body.length < 5) return NextResponse.json({ error: "이메일, 제목, 문의 내용을 확인해 주세요." }, { status: 400 });
    if (email.length > 254 || subject.length > 120 || body.length > 4000) return NextResponse.json({ error: "문의 내용이 허용 길이를 초과했습니다." }, { status: 400 });

    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id || null;
    } catch {}

    const admin = createAdminClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("customer_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", oneHourAgo);
    if (countError) throw countError;
    if ((count || 0) >= 5) return NextResponse.json({ error: "문의가 너무 자주 접수되었습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    const { error } = await admin.from("customer_inquiries").insert({ user_id: userId, email, subject, body, status: "open", priority: "normal" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "문의 접수 오류" }, { status: 500 });
  }
}
