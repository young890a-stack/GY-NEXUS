import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DeleteProductButton from "@/app/admin/products/DeleteProductButton";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let product;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
    if (error || !data) notFound();
    product = data;
  } catch {
    notFound();
  }

  async function updateProduct(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const payload = {
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      image_url: String(formData.get("image_url") || "").trim() || null,
      affiliate_url: String(formData.get("affiliate_url") || "").trim(),
      platform: String(formData.get("platform") || "etc"),
      price_text: String(formData.get("price_text") || "").trim() || null,
    };
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/products");
    revalidatePath("/products");
    redirect("/admin/products");
  }

  return (
    <>
      <div className="admin-top"><div><h1>상품 수정</h1><p>등록된 상품 정보를 변경합니다.</p></div><Link className="button button-light" href="/admin/products">← 목록으로</Link></div>
      <div className="card form-card">
        <form className="form-grid" action={updateProduct}>
          <div className="field"><label htmlFor="title">상품명 *</label><input id="title" name="title" className="input" required defaultValue={product.title} /></div>
          <div className="field"><label htmlFor="description">상품 설명</label><textarea id="description" name="description" className="textarea" defaultValue={product.description ?? ""} /></div>
          <div className="field"><label htmlFor="price_text">가격 표시</label><input id="price_text" name="price_text" className="input" defaultValue={product.price_text ?? ""} /></div>
          <div className="field"><label htmlFor="image_url">상품 이미지 URL</label><input id="image_url" name="image_url" className="input" type="url" defaultValue={product.image_url ?? ""} /></div>
          <div className="field"><label htmlFor="affiliate_url">제휴 링크 *</label><input id="affiliate_url" name="affiliate_url" className="input" type="url" required defaultValue={product.affiliate_url} /></div>
          <div className="field"><label htmlFor="platform">플랫폼</label><select id="platform" name="platform" className="select" defaultValue={product.platform ?? "etc"}><option value="coupang">쿠팡</option><option value="temu">테무</option><option value="naver">네이버</option><option value="etc">기타</option></select></div>
          <div className="actions" style={{ marginTop: 0 }}><button className="button button-primary" type="submit">변경 내용 저장</button><DeleteProductButton id={id} /></div>
        </form>
      </div>
    </>
  );
}
