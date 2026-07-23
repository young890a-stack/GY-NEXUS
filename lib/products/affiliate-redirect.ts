import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function cleanSource(value: string | null) {
  const source = (value || "direct").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return source || "direct";
}

function getDeviceType(userAgent: string) {
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

function getReferrerHost(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).hostname.slice(0, 180);
  } catch {
    return null;
  }
}

type Lookup = { id?: string | null; slug?: string | null };

export async function redirectToAffiliate(request: NextRequest, lookup: Lookup) {
  const fallback = new URL("/products", request.url);

  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("products")
      .select("id,slug,affiliate_url,status,is_public,link_status")
      .limit(1);

    if (lookup.slug) query = query.eq("slug", lookup.slug);
    else if (lookup.id) query = query.eq("id", lookup.id);
    else return NextResponse.redirect(fallback);

    const { data: product, error } = await query.maybeSingle();
    if (error || !product) return NextResponse.redirect(fallback);

    if (!product.is_public || product.status !== "published" || ["broken", "sold_out"].includes(product.link_status)) {
      return NextResponse.redirect(fallback);
    }

    let affiliateUrl: URL;
    try {
      affiliateUrl = new URL(product.affiliate_url);
    } catch {
      return NextResponse.redirect(fallback);
    }
    if (!['http:', 'https:'].includes(affiliateUrl.protocol)) return NextResponse.redirect(fallback);

    const source = cleanSource(request.nextUrl.searchParams.get("source"));
    const deviceType = getDeviceType(request.headers.get("user-agent") || "");
    const referrerHost = getReferrerHost(request.headers.get("referer"));

    const { error: clickError } = await supabase.from("product_clicks").insert({
      product_id: product.id,
      source,
      device_type: deviceType,
      referrer_host: referrerHost,
    });
    if (clickError) console.error("제휴 클릭 기록 실패:", clickError.message);

    const response = NextResponse.redirect(affiliateUrl);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    console.error("제휴 링크 이동 실패:", error);
    return NextResponse.redirect(fallback);
  }
}
