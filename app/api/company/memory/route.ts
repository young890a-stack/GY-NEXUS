import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { category?: string; key?: string; value?: string; priority?: number };
    if (!body.category || !body.key || !body.value) return NextResponse.json({ success:false, message:"분류, 이름, 내용을 모두 입력해주세요." }, { status:400 });
    const supabase = await createClient();
    const { data, error } = await supabase.from("company_memories").upsert({ category:body.category.trim(), key:body.key.trim(), value:body.value.trim(), priority:body.priority || 50, is_active:true }, { onConflict:"category,key" }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ success:true, item:data });
  } catch (error) { return NextResponse.json({ success:false, message:error instanceof Error?error.message:"기억 저장 실패" }, { status:500 }); }
}
