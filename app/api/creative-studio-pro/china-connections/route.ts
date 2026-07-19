import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const douyinConfigured = Boolean(process.env.DOUYIN_CLIENT_KEY && process.env.DOUYIN_CLIENT_SECRET);
  const xiaohongshuConfigured = Boolean(process.env.XIAOHONGSHU_APP_KEY && process.env.XIAOHONGSHU_APP_SECRET);
  return NextResponse.json({
    success: true,
    connections: {
      douyin: {
        configured: douyinConfigured,
        mode: douyinConfigured ? "approved-official-app" : "search-and-share-link",
        note: douyinConfigured
          ? "공식 앱 키가 설정되었습니다. 계정 승인 범위에 따라 본인 계정 영상 기능을 활성화할 수 있습니다."
          : "일반 공개영상 자동 수집 대신 검색 실행과 공유 링크 수집을 사용합니다.",
      },
      xiaohongshu: {
        configured: xiaohongshuConfigured,
        mode: xiaohongshuConfigured ? "approved-official-app" : "search-and-share-link",
        note: xiaohongshuConfigured
          ? "공식 앱 키가 설정되었습니다. 승인받은 상거래 API 범위에서만 사용합니다."
          : "공개 콘텐츠 검색·다운로드 API로 가장하지 않고 검색 실행과 공유 링크 수집을 사용합니다.",
      },
    },
  });
}
