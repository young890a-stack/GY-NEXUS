import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { createClient } from "@/lib/supabase/client";

export default async function AdminProductsPage() {
  const supabase = createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select(`
      *,
      product_clicks(id)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("상품 조회 오류:", error);

    return (
      <main style={{ padding: "40px" }}>
        상품을 불러오지 못했습니다.
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "40px",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "30px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "28px",
                marginBottom: "8px",
              }}
            >
              📦 상품 관리
            </h1>

            <p style={{ color: "#666" }}>
              등록한 제휴상품과 클릭수를 관리하는 화면입니다.
            </p>
          </div>

          <Link
            href="/admin/products/new"
            style={{
              background: "#111827",
              color: "white",
              padding: "12px 18px",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            + 새 상품 등록
          </Link>
        </div>

        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          {!products || products.length === 0 ? (
            <p>등록된 상품이 없습니다.</p>
          ) : (
            products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}