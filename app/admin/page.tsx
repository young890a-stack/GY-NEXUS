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
    <main style={{ padding: "40px", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>📦 상품 관리</h1>
            <p style={{ color: "#666" }}>등록한 제휴상품을 관리하는 화면입니다.</p>
          </div>

          <Link href="/admin/products/new" style={buttonStyle}>
            + 새 상품 등록
          </Link>
        </div>

        <div style={gridStyle}>
          {products?.map((product) => (
            <div key={product.id} style={cardStyle}>
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.title}
                  style={imageStyle}
                />
              )}

              <div style={{ padding: "18px" }}>
                <p style={badgeStyle}>{product.platform || "기타"}</p>
                <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>
                  {product.title}
                </h2>

                <p style={{ color: "#555", minHeight: "44px" }}>
                  {product.description}
                </p>

                {product.price_text && (
                  <p style={{ fontSize: "18px", fontWeight: "bold", marginTop: "12px" }}>
                    💰 {product.price_text}
                  </p>
                )}

                <p style={{ color: "#2563eb", fontWeight: "bold", marginTop: "10px" }}>
                  클릭 수: {product.clicks ?? 0}회
                </p>

                <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                  <Link href={`/admin/products/${product.id}/edit`} style={smallButtonStyle}>
                    수정
                  </Link>

                  <Link href={`/go?id=${product.id}`} target="_blank" style={smallButtonStyle}>
                    상품 링크 확인
                  </Link>
                  <button
  onClick={async () => {
    const res = await fetch("/api/ai/blog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: product.title,
        description: product.description,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      alert("AI 생성 실패");
      return;
    }

    console.log(data.blog);

    alert("AI 블로그가 생성되었습니다.");
  }}
  style={{
    background: "#10b981",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "8px",
    cursor: "pointer",
  }}
>
🤖 AI 블로그 생성
</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

const gridStyle: React.CSSProperties = {
  marginTop: "30px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "20px",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
};

const imageStyle: React.CSSProperties = {
  width: "100%",
  height: "180px",
  objectFit: "cover",
  background: "#f1f5f9",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  background: "#eef2ff",
  color: "#4338ca",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "bold",
};

const buttonStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  padding: "12px 18px",
  borderRadius: "10px",
  textDecoration: "none",
  fontWeight: "bold",
};

const smallButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "8px 12px",
  borderRadius: "8px",
  textDecoration: "none",
  color: "#111827",
  background: "white",
};