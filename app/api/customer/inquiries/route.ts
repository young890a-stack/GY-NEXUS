import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const email = String(payload.email || "").trim();
    const subject = String(payload.subject || "").trim();
    const body = String(payload.body || "").trim();
    if (!email || !subject || body.length < 5) return NextResponse.json({ error: "이메일, 제목, 문의 내용을 확인해 주세요." }, { status: 400 });

    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id || null;
    } catch {}

    const admin = createAdminClient();
    const { error } = await admin.from("customer_inquiries").insert({ user_id: userId, email, subject, body, status: "open", priority: "normal" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "문의 접수 오류" }, { status: 500 });
  }
}
