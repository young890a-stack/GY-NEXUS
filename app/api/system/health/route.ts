import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { hasOpenAIEnv, hasSupabaseEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    app: { ok: true, message: "Next.js 서버 정상" },
    supabase: { ok: false, message: "Supabase 환경변수 없음" },
    database: { ok: false, message: "데이터베이스 미확인" },
    openai: { ok: false, message: "OpenAI API 키 없음" },
  };

  if (hasSupabaseEnv()) {
    checks.supabase = { ok: true, message: "Supabase 환경변수 확인" };
    try {
      const supabase = await createClient();
      const { error } = await supabase.from("products").select("id", { count: "exact", head: true });
      checks.database = error
        ? { ok: false, message: `DB 연결 실패: ${error.message}` }
        : { ok: true, message: "DB 및 products 테이블 정상" };
    } catch (error) {
      checks.database = { ok: false, message: error instanceof Error ? error.message : "DB 연결 실패" };
    }
  }

  if (hasOpenAIEnv()) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      await client.models.list();
      checks.openai = { ok: true, message: "OpenAI API 연결 정상" };
    } catch (error) {
      checks.openai = { ok: false, message: error instanceof Error ? `OpenAI 연결 실패: ${error.message}` : "OpenAI 연결 실패" };
    }
  }

  const ok = Object.values(checks).every((check) => check.ok);
  return NextResponse.json({ ok, checkedAt: new Date().toISOString(), checks }, { status: ok ? 200 : 503 });
}
