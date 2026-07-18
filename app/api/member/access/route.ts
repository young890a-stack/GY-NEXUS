import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMemberAccess } from "@/lib/subscriptions/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const access = await getMemberAccess(user.id);
  return NextResponse.json(access, { headers: { "Cache-Control": "private, no-store" } });
}
