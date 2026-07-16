import { NextResponse } from "next/server";
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("gy_blogger_token");
  response.cookies.delete("gy_blogger_state");
  return response;
}
