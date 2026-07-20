import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function workerHealth() {
  const workerUrl = String(process.env.VIDEO_WORKER_URL || "").replace(/\/$/, "");
  if (!workerUrl) return { configured: false, reachable: false, message: "VIDEO_WORKER_URL 미설정" };
  try {
    const response = await fetch(`${workerUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    return {
      configured: true,
      reachable: response.ok,
      message: response.ok ? "FFmpeg Worker 연결됨" : `FFmpeg Worker 응답 ${response.status}`,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      message: error instanceof Error ? error.message : "FFmpeg Worker 연결 실패",
    };
  }
}

export async function GET() {
  const worker = await workerHealth();
  return NextResponse.json({
    success: true,
    version: "1.0.0",
    checkedAt: new Date().toISOString(),
    services: {
      supabase: {
        configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
        message: process.env.SUPABASE_SERVICE_ROLE_KEY ? "Supabase 서버 연결 준비됨" : "Supabase 환경변수 확인 필요",
      },
      worker,
      openai: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        optional: true,
        message: process.env.OPENAI_API_KEY ? "AI 품질 향상 기능 사용 가능" : "AI 없이 무료·로컬 모드 사용 가능",
      },
    },
  });
}
