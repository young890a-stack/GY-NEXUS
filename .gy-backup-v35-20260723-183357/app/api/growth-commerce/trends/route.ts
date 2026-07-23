import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function shoppingFit(title: string, news: string) {
  const text = `${title} ${news}`.toLowerCase();
  const commerce = ["할인", "가격", "신제품", "출시", "추천", "리뷰", "구매", "쇼핑", "여름", "장마", "에어컨", "선풍기", "제습", "청소", "세탁", "태블릿", "이어폰", "노트북", "충전", "주방", "생활"];
  const blocked = ["사망", "사고", "전쟁", "선거", "범죄", "실종"];
  const score = 35 + commerce.filter((word) => text.includes(word)).length * 13 - blocked.filter((word) => text.includes(word)).length * 25;
  return Math.max(0, Math.min(100, score));
}

export async function GET() {
  try {
    const url = process.env.GOOGLE_TRENDS_RSS_URL?.trim() || "https://trends.google.com/trending/rss?geo=KR";
    const response = await fetch(url, { headers: { "User-Agent": "GY-NEXUS/3.5" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Google Trends RSS 응답 오류 (${response.status})`);
    const xml = await response.text();
    const rows = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match, index) => {
      const block = match[1];
      const title = tag(block, "title");
      const trafficText = tag(block, "ht:approx_traffic") || tag(block, "approx_traffic");
      const traffic = Number(trafficText.replace(/[^0-9]/g, "")) || 0;
      const news = [...block.matchAll(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/gi)]
        .map((item) => decodeXml(item[1])).slice(0, 3);
      return {
        source: "google-trends-rss",
        region: "KR",
        keyword: title,
        traffic,
        shopping_fit: shoppingFit(title, news.join(" ")),
        rank: index + 1,
        related_news: news,
        source_url: tag(block, "link") || url,
        observed_at: new Date().toISOString(),
        raw: { trafficText },
      };
    }).filter((row) => row.keyword).slice(0, 50);

    if (!rows.length) throw new Error("Google Trends RSS에서 급상승 키워드를 읽지 못했습니다.");
    const supabase = createAdminClient();
    const { error } = await supabase.from("growth_trends_v35").upsert(rows, { onConflict: "region,keyword,observed_date" });
    if (error) throw error;
    return NextResponse.json({ success: true, trends: rows, message: `대한민국 급상승 키워드 ${rows.length}개를 수집했습니다.` });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "트렌드 수집 실패" }, { status: 500 });
  }
}
