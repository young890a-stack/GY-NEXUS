import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: products, error } = await supabase
  .from("products")
  .select(`
    *,
    product_clicks(id)
  `)
  .order("created_at", { ascending: false });

  if (error) {
    return (
      <main style={{ padding: "40px" }}>
        상품을 불러오지 못했습니다.
      </main>
    );
  }

  return (
    <main style={{ padding: "40px", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "32px", marginBottom: "10px" }}>
          추천 상품 모음
        </h1>

        <p style={{ color: "#666", marginBottom: "30px" }}>
          실생활에 도움이 되는 제휴상품을 보기 쉽게 정리했습니다.
        </p>

        {products?.length === 0 && <p>등록된 상품이 없습니다.</p>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
          }}
        >
          {products?.map((product) => (
            <div
              key={product.id}
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                padding: "22px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#2563eb",
                  fontWeight: "bold",
                  marginBottom: "10px",
                }}
              >
                {product.platform}
              </div>

              <h2 style={{ fontSize: "20px", marginBottom: "10px" }}>
                {product.title}
              </h2>

              <p style={{ color: "#555", marginBottom: "16px" }}>
             {product.description}
              </p>

             <p style={{ color: "#2563eb", fontWeight: "bold", marginBottom: "16px" }}>
             클릭 수: {product.product_clicks?.length || 0}회
              </p>

              <Link
              href={`/go?id=${product.id}`}
              target="_blank"
              style={{
               display: "inline-block",
               background: "#111827",
               color: "white",
               padding: "12px 16px",
               borderRadius: "10px",
               textDecoration: "none",
  }}
>
  상품 보러가기
</Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}