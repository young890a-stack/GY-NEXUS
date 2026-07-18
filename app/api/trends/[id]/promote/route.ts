import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params;const supabase=createAdminClient();const {data:item,error}=await supabase.from("trend_products").select("*").eq("id",id).single();if(error)throw error;
 let productId=item.product_id; if(!productId){const {data:product,error:insertError}=await supabase.from("products").insert({title:item.title,description:item.description,image_url:item.image_url||null,affiliate_url:item.affiliate_url,platform:item.platform,price_text:item.price_text||null}).select("id").single();if(insertError)throw insertError;productId=product.id;}
 const {error:updateError}=await supabase.from("trend_products").update({product_id:productId,status:"approved"}).eq("id",id);if(updateError)throw updateError;return NextResponse.json({success:true,productId});
 }catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"정식 상품 전환 실패"},{status:500});}
}
