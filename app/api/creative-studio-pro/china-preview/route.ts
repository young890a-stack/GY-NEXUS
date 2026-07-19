import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

type PreviewPlatform = "douyin" | "xiaohongshu";

function platformForUrl(value: string): PreviewPlatform | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "douyin.com" || hostname.endsWith(".douyin.com") || hostname.endsWith(".iesdouyin.com")) return "douyin";
    if (hostname === "xiaohongshu.com" || hostname.endsWith(".xiaohongshu.com") || hostname === "xhslink.com" || hostname.endsWith(".xhslink.com")) return "xiaohongshu";
  } catch {
    return null;
  }
  return null;
}

function douyinVideoId(value: string) {
  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/\/video\/(\d{10,30})(?:\/|$)/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function safeDouyinPlayerUrl(iframeCode: string) {
  const match = iframeCode.match(/\bsrc=["']([^"']+)["']/i);
  if (!match?.[1]) return "";
  try {
    const parsed = new URL(match[1]);
    if (parsed.protocol !== "https:" || parsed.hostname !== "open.douyin.com" || parsed.pathname !== "/player/video") return "";
    parsed.searchParams.set("autoplay", "0");
    return parsed.toString();
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    const url = String(body.url || "").trim();
    const platform = platformForUrl(url);
    if (!platform) {
      return NextResponse.json({ success: false, message: "도우인 또는 샤오홍슈의 올바른 HTTPS 영상 주소가 아닙니다." }, { status: 400 });
    }

    if (platform === "xiaohongshu") {
      return NextResponse.json({
        success: true,
        platform,
        mode: "platform-player",
        originalUrl: url,
        message: "샤오홍슈는 공개 임베드 플레이어가 없어 로그인된 Edge 원문 플레이어에서 재생합니다.",
      });
    }

    const videoId = douyinVideoId(url);
    if (!videoId) {
      return NextResponse.json({
        success: true,
        platform,
        mode: "platform-player",
        originalUrl: url,
        message: "이 도우인 주소에서는 공개 VideoID를 확인할 수 없어 로그인된 Edge 원문 플레이어에서 재생합니다.",
      });
    }

    const response = await fetch(`https://open.douyin.com/api/douyin/v1/video/get_iframe_by_video?video_id=${encodeURIComponent(videoId)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json().catch(() => ({})) as {
      err_no?: number;
      err_msg?: string;
      data?: { iframe_code?: string; video_title?: string; video_width?: number; video_height?: number };
    };
    const embedUrl = safeDouyinPlayerUrl(String(data.data?.iframe_code || ""));
    if (!response.ok || Number(data.err_no) !== 0 || !embedUrl) {
      return NextResponse.json({
        success: true,
        platform,
        mode: "platform-player",
        originalUrl: url,
        message: String(data.err_msg || "공개 임베드 재생이 허용되지 않아 로그인된 Edge 원문 플레이어에서 재생합니다."),
      });
    }

    return NextResponse.json({
      success: true,
      platform,
      mode: "official-embed",
      embedUrl,
      originalUrl: url,
      title: String(data.data?.video_title || "도우인 공개 영상").slice(0, 160),
      width: Number(data.data?.video_width) || 720,
      height: Number(data.data?.video_height) || 1280,
      message: "도우인 공식 공개 플레이어를 불러왔습니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "영상 미리보기를 준비하지 못했습니다.",
    }, { status: 500 });
  }
}
