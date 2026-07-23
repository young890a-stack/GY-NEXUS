import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { durationBucket, safeNumber, titlePattern } from "@/lib/growth-commerce/scoring";

function average(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }

export async function POST() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("youtube_video_metrics_v35").select("*").order("synced_at", { ascending: false }).limit(300);
    if (error) throw error;
    const rows = (data || []) as Array<Record<string, unknown>>;
    const minSample = Math.max(3, Number(process.env.LEARNING_MIN_SAMPLE_SIZE) || 10);
    const groups = new Map<string, Array<Record<string, unknown>>>();
    for (const row of rows) {
      const patterns = [
        `title:${titlePattern(String(row.title || ""))}`,
        `duration:${durationBucket(safeNumber(row.duration_seconds))}`,
      ];
      for (const key of patterns) groups.set(key, [...(groups.get(key) || []), row]);
    }
    const allScore = average(rows.map((row) => safeNumber(row.commerce_score)));
    const rules = [...groups.entries()].map(([key, sample]) => {
      const score = average(sample.map((row) => safeNumber(row.commerce_score)));
      const retention = average(sample.map((row) => safeNumber(row.average_view_percentage)));
      const clickRate = average(sample.map((row) => safeNumber(row.views) > 0 ? safeNumber(row.attributed_clicks) / safeNumber(row.views) * 100 : 0));
      const conversionRate = average(sample.map((row) => safeNumber(row.attributed_clicks) > 0 ? safeNumber(row.conversions) / safeNumber(row.attributed_clicks) * 100 : 0));
      const [ruleType, segment] = key.split(":");
      const confidence = Math.min(100, Math.round((sample.length / minSample) * 70 + Math.min(30, Math.abs(score - allScore))));
      const direction = score >= allScore ? "prefer" : "avoid";
      return {
        rule_key: key,
        rule_type: ruleType,
        segment,
        direction,
        score: Math.round(score),
        lift_percent: allScore ? Number((((score - allScore) / allScore) * 100).toFixed(2)) : 0,
        sample_size: sample.length,
        confidence,
        active: sample.length >= minSample,
        evidence: { retention: Number(retention.toFixed(2)), clickRate: Number(clickRate.toFixed(3)), conversionRate: Number(conversionRate.toFixed(3)), baseline: Number(allScore.toFixed(2)) },
        recommendation: direction === "prefer" ? `${segment} 패턴을 다음 제작안에 우선 적용` : `${segment} 패턴은 충분한 반전·증거 장면이 없으면 축소`,
        updated_at: new Date().toISOString(),
      };
    });
    if (rules.length) {
      const { error: upsertError } = await supabase.from("commerce_learning_rules_v35").upsert(rules, { onConflict: "rule_key" });
      if (upsertError) throw upsertError;
    }
    return NextResponse.json({ success: true, rules: rules.sort((a, b) => b.score - a.score), sampleSize: rows.length, message: `영상 ${rows.length}개의 조회·시청·클릭·판매 데이터를 학습했습니다.` });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "학습 규칙 계산 실패" }, { status: 500 });
  }
}
