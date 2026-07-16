import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(){
 try{const db=createAdminClient(); const {data,error}=await db.from("seo_reports").select("id,title,primary_keyword,overall_score,created_at").order("created_at",{ascending:false}).limit(30); if(error)throw error; return NextResponse.json({reports:data||[]});}
 catch(error){return NextResponse.json({message:error instanceof Error?error.message:"조회 실패"},{status:500});}
}
