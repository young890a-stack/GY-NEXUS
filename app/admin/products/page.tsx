import DeleteProductButton from "./DeleteProductButton";
import Link from "next/link";
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
    return <main style={{ padding: "40px" }}>상품을 불러오지 못했습니다.</main>;
  }

  return (
    <main style={{ padding: "40px", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "30px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>📦 상품 관리</h1>
            <p style={{ color: "#666" }}>등록한 제휴상품을 관리하는 화면입니다.</p>
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
          {products?.length === 0 && <p>등록된 상품이 없습니다.</p>}

          {products?.map((product) => (
            <div
              key={product.id}
              style={{
                borderBottom: "1px solid #e5e7eb",
                padding: "20px 0",
              }}
            >
              <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>
                {product.title}
              </h2>

              <p style={{ color: "#555", marginBottom: "16px" }}>
                {product.description}
              </p>

              <p style={{ color: "#2563eb", fontWeight: "bold", marginBottom: "16px" }}>
              클릭 수: {product.product_clicks?.length || 0}회
              </p>

              <div style={{ display: "flex", gap: "10px" }}>
                <Link
                  href={`/admin/products/${product.id}/edit`}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    textDecoration: "none",
                    color: "#111827",
                  }}
                >
                  수정
                </Link>

                <DeleteProductButton id={product.id} />
 
                <Link
                  href={`/go?id=${product.id}`}
                  target="_blank"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    textDecoration: "none",
                    color: "#111827",
                  }}
                >
                  상품 링크 확인
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}