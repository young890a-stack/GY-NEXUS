import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { hasSupabaseEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  let products: Product[] = [];
  let errorMessage = "";

  if (hasSupabaseEnv()) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("products")
        .select("*,product_clicks(id,created_at)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      products = (data ?? []) as Product[];
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "상품을 불러오지 못했습니다.";
    }
  } else {
    errorMessage = "Supabase 설정이 필요합니다. .env.local과 supabase/schema.sql을 먼저 적용해주세요.";
  }

  return (
    <>
      <div className="admin-top">
        <div><h1>상품 관리</h1><p>상품을 관리하고 AI 콘텐츠를 바로 생성하세요.</p></div>
        <Link href="/admin/products/new" className="button button-primary">+ 새 상품 등록</Link>
      </div>
      {errorMessage && <div className="alert alert-warning" style={{ marginBottom: 20 }}>{errorMessage}</div>}
      <div className="product-list">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
        {!products.length && !errorMessage && <div className="card empty">등록된 상품이 없습니다. 첫 상품을 등록해보세요.</div>}
      </div>
    </>
  );
}
