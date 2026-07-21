import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const variants = [
  { variant_key: "A", variant_type: "problem-solution" },
  { variant_key: "B", variant_type: "visual-surprise" },
  { variant_key: "C", variant_type: "comparison-proof" },
] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const productId = String(body.productId || "").trim();
    const discoveryRunId = String(body.discoveryRunId || "").trim();
    const duration = Math.min(30, Math.max(15, Math.round(Number(body.targetDurationSeconds) || 20)));
    if (!productId || !discoveryRunId) {
      return NextResponse.json({ success: false, message: "상품과 중국 쇼츠 수집 작업을 먼저 선택해주세요." }, { status: 400 });
    }
    const supabase = createAdminClient();
    const rows = variants.map((variant) => ({
      product_id: productId,
      discovery_run_id: discoveryRunId,
      creative_project_id: body.creativeProjectId || null,
      ...variant,
      target_duration_seconds: duration,
      quality_threshold: 90,
      status: "planned",
      script: { rule: "한국형 신규 대본, 원본 문장 복제 금지" },
      scene_plan: [],
      quality_report: { approved: false, threshold: 90, blockingRules: ["copyright", "product_mismatch", "subtitle_error", "quality_below_90"] },
    }));
    const { data, error } = await supabase.from("shorts_variant_jobs_v3")
      .upsert(rows, { onConflict: "product_id,discovery_run_id,variant_key" })
      .select("*");
    if (error) throw error;
    return NextResponse.json({ success: true, variants: data ?? [] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "3개 쇼츠 변형 작업을 만들지 못했습니다." }, { status: 500 });
  }
}
