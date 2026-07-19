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
          : "GY-NEXUS 내부 공개 웹 검색과 카드 선택을 사용합니다. 일반 타인 영상 원본은 자동 복사하지 않습니다.",
      },
      xiaohongshu: {
        configured: xiaohongshuConfigured,
        mode: xiaohongshuConfigured ? "approved-official-app" : "search-and-share-link",
        note: xiaohongshuConfigured
          ? "공식 앱 키가 설정되었습니다. 승인받은 상거래 API 범위에서만 사용합니다."
          : "GY-NEXUS 내부 공개 웹 검색과 카드 선택을 사용합니다. 검색 카드는 트렌드 구조 분석용입니다.",
      },
    },
  });
}
