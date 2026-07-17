import { NextResponse } from "next/server";
import { generateContentFactoryPackage } from "@/lib/content-factory/generate";
import { createClient } from "@/lib/supabase/server";
import type { FactoryInput } from "@/lib/content-factory/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FactoryInput;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ success: false, message: "상품명을 입력해주세요." }, { status: 400 });

    const input: FactoryInput = {
      productId: body.productId,
      title,
      description: body.description?.trim() || "",
      affiliateUrl: body.affiliateUrl?.trim() || "",
      imageUrl: body.imageUrl?.trim() || "",
      targetAudience: body.targetAudience?.trim() || "20~40대",
      shortsDuration: [15, 20, 25, 30].includes(Number(body.shortsDuration)) ? Number(body.shortsDuration) as 15 | 20 | 25 | 30 : 20,
      tone: body.tone?.trim() || "신뢰감 있고 자연스러운 전문가형",
      blogGoal: ["adsense", "adpost", "sales", "review"].includes(String(body.blogGoal)) ? body.blogGoal : "sales",
      blogLength: body.blogLength === "long" ? "long" : "standard",
    };

    const result = await generateContentFactoryPackage(input);
    let saved = false;
    let runId: string | null = null;

    try {
      const supabase = await createClient();
      const { data, error } = await supabase.from("content_factory_runs").insert({
        product_id: input.productId || null,
        product_title: input.title,
        input_data: input,
        output_data: result,
        status: "completed",
      }).select("id").single();
      if (error) throw error;
      saved = true;
      runId = data?.id ?? null;

      await supabase.from("ai_contents").insert({
        product_id: input.productId || null,
        product_title: input.title,
        content_type: "package",
        title: result.packageTitle || `${input.title} 콘텐츠 패키지`,
        content: JSON.stringify(result),
      });
    } catch (saveError) {
      console.warn("CONTENT FACTORY SAVE WARNING", saveError);
    }

    return NextResponse.json({ success: true, result, saved, runId, message: saved ? "콘텐츠 패키지 생성과 저장이 완료되었습니다." : "콘텐츠 패키지는 생성되었지만 DB 저장은 건너뛰었습니다. schema.sql 실행 여부를 확인해주세요." });
  } catch (error) {
    console.error("CONTENT FACTORY ERROR", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "콘텐츠 공장 실행에 실패했습니다." }, { status: 500 });
  }
}
