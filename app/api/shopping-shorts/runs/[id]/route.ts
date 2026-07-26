import { NextResponse } from "next/server";
import { AuthorizationError, requireOwner } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }
  return NextResponse.json({
    success: false,
    message: error instanceof Error ? error.message : "쇼츠 제작 결과를 불러오지 못했습니다.",
  }, { status: 500 });
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    const { id } = await context.params;
    const supabase = createAdminClient();
    const [{ data: run, error: runError }, { data: variants, error: variantError }] = await Promise.all([
      supabase.from("shopping_shorts_runs").select("*").eq("id", id).single(),
      supabase.from("shopping_shorts_variants").select("*").eq("run_id", id).order("hook_index").order("duration_seconds"),
    ]);
    if (runError || !run) throw runError || new Error("제작 실행을 찾을 수 없습니다.");
    if (variantError) throw variantError;
    return NextResponse.json({ success: true, run, variants: variants || [] });
  } catch (error) {
    return failure(error);
  }
}

