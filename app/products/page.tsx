import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let products: Product[] = [];
  let message = "";
  if (hasSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.from("products").select("*,product_clicks(id)").order("created_at", { ascending: false });
      if (error) throw error;
      products = (data ?? []) as Product[];
    } catch (error) {
      message = error instanceof Error ? error.message : "상품을 불러오지 못했습니다.";
    }
  } else {
    message = "관리자가 아직 데이터베이스 연결을 완료하지 않았습니다.";
  }

  return (
    <div className="shell">
      <SiteHeader />
      <section className="section">
        <div className="container">
          <div className="section-head"><div><span className="eyebrow">GY-NEXUS PICKS</span><h1 style={{ marginTop: 12 }}>추천 상품 모음</h1><p>실생활에 도움이 되는 상품을 보기 쉽게 정리했습니다.</p></div></div>
          {message && <div className="alert alert-warning" style={{ marginBottom: 20 }}>{message}</div>}
          <div className="grid public-products">
            {products.map((product) => (
              <article className="card public-card" key={product.id}>
                {product.image_url ? <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="product-image" style={{ borderRadius: 0, border: 0 }} src={product.image_url} alt={product.title} />
                </> : <div className="product-image image-placeholder" style={{ borderRadius: 0 }}>이미지 없음</div>}
                <div className="content"><span className="badge">{product.platform || "추천"}</span><h2>{product.title}</h2><p>{product.description || "상품 상세 정보를 확인해보세요."}</p>{product.price_text && <b>{product.price_text}</b>}<div className="product-actions"><Link className="button button-dark" href={`/go?id=${product.id}`} target="_blank">상품 보러가기</Link></div><p className="help">누적 클릭 {product.product_clicks?.length ?? 0}회</p></div>
              </article>
            ))}
          </div>
          {!products.length && !message && <div className="card empty">현재 등록된 상품이 없습니다.</div>}
        </div>
      </section>
    </div>
  );
}
