import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const productId = String(body.productId || "").trim();
  if (!productId) return NextResponse.json({ success: false, message: "productId가 필요합니다." }, { status: 400 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
  const url = new URL("/go", origin);
  url.searchParams.set("id", productId);
  const contentKey = String(body.contentKey || "").trim();
  const channel = String(body.channel || "youtube").trim();
  const videoId = String(body.videoId || "").trim();
  if (contentKey) url.searchParams.set("content", contentKey.slice(0, 100));
  if (channel) url.searchParams.set("channel", channel.slice(0, 30));
  if (videoId) url.searchParams.set("video", videoId.slice(0, 100));
  return NextResponse.json({ success: true, url: url.toString() });
}
