import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProductSlug } from "@/lib/products/slug";

type ProductPayload = Record<string, unknown>;

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function requiredText(value: unknown) {
  return optionalText(value) || "";
}

function listFromText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return requiredText(value).split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function safeUrl(value: unknown, fieldName: string, required = false) {
  const text = optionalText(value);
  if (!text && !required) return null;
  if (!text) throw new Error(`${fieldName}은(는) 필수입니다.`);
  const parsed = new URL(text);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${fieldName}은 http 또는 https 주소만 사용할 수 있습니다.`);
  return text;
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("products")
      .select("*,product_clicks(id,created_at,source,device_type,referrer_host)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ products: data ?? [] });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "상품 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProductPayload;
    const title = requiredText(body.title);
    if (!title) return NextResponse.json({ message: "상품명은 필수입니다." }, { status: 400 });

    const status = requiredText(body.status) || "draft";
    const isPublic = Boolean(body.is_public) && status === "published";
    const score = Math.max(0, Math.min(100, Number(body.quality_score) || 0));
    const now = new Date().toISOString();

    const payload = {
      slug: createProductSlug(title),
      title,
      description: optionalText(body.description),
      image_url: safeUrl(body.image_url, "상품 이미지 URL"),
      affiliate_url: safeUrl(body.affiliate_url, "제휴 링크", true),
      platform: optionalText(body.platform) || "etc",
      price_text: optionalText(body.price_text),
      category: optionalText(body.category) || "etc",
      status,
      is_public: isPublic,
      is_featured: Boolean(body.is_featured),
      quality_score: score,
      target_audience: optionalText(body.target_audience),
      selling_points: listFromText(body.selling_points),
      usage_tips: optionalText(body.usage_tips),
      cautions: optionalText(body.cautions),
      short_video_url: safeUrl(body.short_video_url, "15초 쇼츠 URL"),
      long_video_url: safeUrl(body.long_video_url, "상세 쇼츠 URL"),
      review_url: safeUrl(body.review_url, "리뷰 URL"),
      link_status: optionalText(body.link_status) || "unchecked",
      price_checked_at: optionalText(body.price_text) ? now : null,
      published_at: isPublic ? now : null,
      updated_at: now,
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase.from("products").insert(payload).select("id,slug").single();
    if (error) throw error;
    return NextResponse.json({ success: true, product: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "상품 등록에 실패했습니다.";
    return NextResponse.json({ message }, { status: message.includes("URL") || message.includes("필수") ? 400 : 500 });
  }
}
