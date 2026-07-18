import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ProductPayload = {
  title?: unknown;
  description?: unknown;
  image_url?: unknown;
  affiliate_url?: unknown;
  platform?: unknown;
  price_text?: unknown;
};

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, title, description, image_url, affiliate_url, platform, price_text, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ products: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "상품 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProductPayload;
    const title = optionalText(body.title);
    const affiliateUrl = optionalText(body.affiliate_url);

    if (!title || !affiliateUrl) {
      return NextResponse.json({ message: "상품명과 제휴 링크는 필수입니다." }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(affiliateUrl);
    } catch {
      return NextResponse.json({ message: "제휴 링크를 올바른 URL로 입력해주세요." }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ message: "제휴 링크는 http 또는 https 주소만 사용할 수 있습니다." }, { status: 400 });
    }

    const payload = {
      title,
      description: optionalText(body.description),
      image_url: optionalText(body.image_url),
      affiliate_url: affiliateUrl,
      platform: optionalText(body.platform) || "etc",
      price_text: optionalText(body.price_text),
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase.from("products").insert(payload).select("id").single();
    if (error) throw error;

    return NextResponse.json({ success: true, product: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "상품 등록에 실패했습니다." },
      { status: 500 },
    );
  }
}
