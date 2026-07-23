import { NextRequest } from "next/server";
import { redirectToAffiliate } from "@/lib/products/affiliate-redirect";

export async function GET(request: NextRequest) {
  return redirectToAffiliate(request, { id: request.nextUrl.searchParams.get("id") });
}
