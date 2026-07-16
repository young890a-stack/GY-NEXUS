import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";
import { getSearchConsoleAccessToken,querySearchPerformance } from "@/lib/search-console/client";
export async function POST(request:Request){try{const body=await request.json() as {siteUrl:string;startDate:string;endDate:string};if(!body.siteUrl)return NextResponse.json({message:"사이트를 선택해주세요."},{status:400});const jar=await cookies();const token=decryptConnectionValue<OAuthToken>(jar.get("gy_gsc_token")?.value);if(!token)return NextResponse.json({message:"Search Console을 먼저 연결해주세요."},{status:401});const access=await getSearchConsoleAccessToken(token);const data=await querySearchPerformance(access,{...body,rowLimit:250});return NextResponse.json({success:true,...data});}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"성과 조회 실패"},{status:500});}}
