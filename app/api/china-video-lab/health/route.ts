import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    success: true,
    checkedAt: new Date().toISOString(),
    services: {
      server: { configured: true, label: "GY-NEXUS 서버" },
      openai: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        label: "AI 중국어 번역",
      },
      publicSearch: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        label: "공개 웹 검색",
      },
      supabase: {
        configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        label: "프로젝트 저장소",
      },
      worker: {
        configured: Boolean(process.env.VIDEO_WORKER_URL || process.env.RENDER_WORKER_URL),
        label: "영상 Worker",
      },
    },
  });
}
