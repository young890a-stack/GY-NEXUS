import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { title?:string; signal?:string; cause?:string; lesson?:string; nextAction?:string };
    if (!body.title || !body.lesson) return NextResponse.json({ success:false, message:"제목과 배운 점은 필수입니다." }, { status:400 });
    const supabase = await createClient();
    const { data,error } = await supabase.from("evolution_entries").insert({ title:body.title, signal:body.signal||"manual", cause:body.cause||"", lesson:body.lesson, next_action:body.nextAction||"", status:"open" }).select("*").single();
    if(error) throw error;
    return NextResponse.json({success:true,item:data});
  } catch(error){ return NextResponse.json({success:false,message:error instanceof Error?error.message:"진화 기록 저장 실패"},{status:500}); }
}
