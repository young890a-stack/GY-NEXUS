import { NextRequest } from "next/server";
import { redirectToAffiliate } from "@/lib/products/affiliate-redirect";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return redirectToAffiliate(request, { slug });
}
