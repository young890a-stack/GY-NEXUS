import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  async function updateProduct(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const affiliate_url = formData.get("affiliate_url") as string;
    const platform = formData.get("platform") as string;

    const { error } = await supabase
      .from("products")
      .update({
        title,
        description,
        affiliate_url,
        platform,
      })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/admin/products");
    redirect("/admin/products");
  }

  if (!product) {
    return <main style={{ padding: "40px" }}>상품을 찾을 수 없습니다.</main>;
  }

  return (
    <main style={{ padding: "40px", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: "700px", margin: "0 auto", background: "white", padding: "30px", borderRadius: "16px" }}>
        <h1>상품 수정</h1>

        <form action={updateProduct}>
          <div style={{ marginTop: "20px" }}>
            <label>상품명</label>
            <input name="title" defaultValue={product.title} required style={inputStyle} />
          </div>

          <div style={{ marginTop: "20px" }}>
            <label>설명</label>
            <textarea name="description" defaultValue={product.description} required style={{ ...inputStyle, height: "120px" }} />
          </div>

          <div style={{ marginTop: "20px" }}>
            <label>제휴링크</label>
            <input name="affiliate_url" defaultValue={product.affiliate_url} required style={inputStyle} />
          </div>

          <div style={{ marginTop: "20px" }}>
            <label>플랫폼</label>
            <select name="platform" defaultValue={product.platform || "coupang"} style={inputStyle}>
              <option value="coupang">쿠팡</option>
              <option value="temu">테무</option>
              <option value="naver">네이버</option>
              <option value="etc">기타</option>
            </select>
          </div>

          <button type="submit" style={buttonStyle}>
            저장하기
          </button>
        </form>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  marginTop: "8px",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
};

const buttonStyle: React.CSSProperties = {
  marginTop: "30px",
  background: "#111827",
  color: "white",
  padding: "12px 18px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
};