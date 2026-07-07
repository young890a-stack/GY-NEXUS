import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default async function AdminProductsPage() {
  const supabase = createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <main style={{ padding: "40px" }}>상품을 불러오지 못했습니다.</main>;
  }

  return (
    <main style={{ padding: "40px" }}>
      <h1>상품 관리</h1>

      <Link href="/admin/products/new">
        + 새 상품 등록
      </Link>

      <div style={{ marginTop: "30px" }}>
        {products?.map((product) => (
          <div
            key={product.id}
            style={{
              border: "1px solid #ddd",
              padding: "20px",
              borderRadius: "10px",
              marginBottom: "15px",
            }}
          >
            <h2>{product.title}</h2>
            <p>{product.description}</p>

            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <Link href={`/admin/products/${product.id}/edit`}>
                수정
              </Link>

              <Link href={`/go?id=${product.id}`} target="_blank">
                상품 링크 확인
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}