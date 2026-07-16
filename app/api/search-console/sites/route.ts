import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";
import { getSearchConsoleAccessToken,listSearchConsoleSites } from "@/lib/search-console/client";
export async function GET(){try{const jar=await cookies();const token=decryptConnectionValue<OAuthToken>(jar.get("gy_gsc_token")?.value);if(!token)return NextResponse.json({connected:false,sites:[]});const access=await getSearchConsoleAccessToken(token);const data=await listSearchConsoleSites(access);return NextResponse.json({connected:true,sites:data.siteEntry||[]});}catch(error){return NextResponse.json({connected:false,sites:[],message:error instanceof Error?error.message:"조회 실패"},{status:500});}}
