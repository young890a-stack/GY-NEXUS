import { NextResponse } from "next/server";
import { generateSeoReport } from "@/lib/seo/generate-report";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SeoInput } from "@/lib/seo/types";

export async function POST(request: Request) {
  try {
    const input = await request.json() as SeoInput;
    if (!input.title?.trim() || !input.content?.trim() || !input.primaryKeyword?.trim()) return NextResponse.json({ message: "제목, 본문, 핵심 키워드를 모두 입력해주세요." }, { status: 400 });
    const report = await generateSeoReport(input);
    let saved = false;
    try {
      const supabase = createAdminClient();
      const { error } = await supabase.from("seo_reports").insert({ title: input.title, content_url: input.contentUrl || null, primary_keyword: input.primaryKeyword, input_content: input.content, overall_score: report.scores.overall, report_json: report });
      saved = !error;
    } catch { saved = false; }
    return NextResponse.json({ success: true, report, saved });
  } catch (error) {
    console.error("SEO ANALYZE ERROR", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "SEO 분석에 실패했습니다." }, { status: 500 });
  }
}
