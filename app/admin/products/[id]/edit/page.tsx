import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DeleteProductButton from "@/app/admin/products/DeleteProductButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProductSlug } from "@/lib/products/slug";

export const dynamic = "force-dynamic";

function text(formData: FormData, key: string) { return String(formData.get(key) || "").trim(); }
function optional(formData: FormData, key: string) { return text(formData, key) || null; }
function points(formData: FormData) { return text(formData, "selling_points").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean); }

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: product, error } = await supabase.from("products").select("*").eq("id", id).single();
  if (error || !product) notFound();

  async function updateProduct(formData: FormData) {
    "use server";
    const client = createAdminClient();
    const status = text(formData, "status") || "draft";
    const isPublic = formData.has("is_public") && status === "published";
    const now = new Date().toISOString();
    const payload = {
      slug: product.slug || createProductSlug(text(formData, "title"), id.slice(0, 8)),
      title: text(formData, "title"), description: optional(formData, "description"), image_url: optional(formData, "image_url"), affiliate_url: text(formData, "affiliate_url"),
      platform: text(formData, "platform") || "etc", price_text: optional(formData, "price_text"), category: text(formData, "category") || "etc", status,
      is_public: isPublic, is_featured: formData.has("is_featured"), quality_score: Math.max(0, Math.min(100, Number(text(formData, "quality_score")) || 0)),
      target_audience: optional(formData, "target_audience"), selling_points: points(formData), usage_tips: optional(formData, "usage_tips"), cautions: optional(formData, "cautions"),
      short_video_url: optional(formData, "short_video_url"), long_video_url: optional(formData, "long_video_url"), review_url: optional(formData, "review_url"), link_status: text(formData, "link_status") || "unchecked",
      price_checked_at: optional(formData, "price_text") ? now : product.price_checked_at, published_at: isPublic ? (product.published_at || now) : null, updated_at: now,
    };
    const { error: updateError } = await client.from("products").update(payload).eq("id", id);
    if (updateError) throw new Error(updateError.message);
    revalidatePath("/admin/products"); revalidatePath("/products"); revalidatePath(`/products/${payload.slug}`); redirect("/admin/products");
  }

  return (<><div className="admin-top"><div><h1>상품 수정·공개 관리</h1><p>대표 승인, 품질, 링크 상태와 쇼츠 연결을 관리합니다.</p></div><Link className="button button-light" href="/admin/products">← 목록으로</Link></div><div className="card form-card"><form className="form-grid" action={updateProduct}>
          <div className="field"><label htmlFor="title">상품명 *</label><input id="title" name="title" className="input" required defaultValue={product.title} /></div>
          <div className="field"><label htmlFor="description">상품 설명</label><textarea id="description" name="description" className="textarea" defaultValue={product.description ?? ""} /></div>
          <div className="field"><label htmlFor="category">카테고리</label><select id="category" name="category" className="select" defaultValue={product.category ?? "etc"}><option value="life-cleaning">생활·청소</option><option value="digital-electronics">디지털·전자기기</option><option value="laptop-tablet">노트북·태블릿</option><option value="deals">할인·기획</option><option value="etc">기타</option></select></div>
          <div className="field"><label htmlFor="platform">판매 플랫폼</label><select id="platform" name="platform" className="select" defaultValue={product.platform ?? "etc"}><option value="coupang">쿠팡</option><option value="temu">테무</option><option value="naver">네이버</option><option value="etc">기타</option></select></div>
          <div className="field"><label htmlFor="price_text">가격 표시</label><input id="price_text" name="price_text" className="input" defaultValue={product.price_text ?? ""} placeholder="예: 19,900원" /></div>
          <div className="field"><label htmlFor="quality_score">상품 품질점수</label><input id="quality_score" name="quality_score" className="input" type="number" min="0" max="100" defaultValue={product.quality_score ?? 0} /></div>
          <div className="field"><label htmlFor="image_url">대표 이미지 URL</label><input id="image_url" name="image_url" className="input" type="url" defaultValue={product.image_url ?? ""} placeholder="https://..." /></div>
          <div className="field"><label htmlFor="affiliate_url">제휴 링크 *</label><input id="affiliate_url" name="affiliate_url" className="input" type="url" required defaultValue={product.affiliate_url} placeholder="https://link.coupang.com/..." /></div>
          <div className="field"><label htmlFor="target_audience">추천 대상</label><textarea id="target_audience" name="target_audience" className="textarea" defaultValue={product.target_audience ?? ""} /></div>
          <div className="field"><label htmlFor="selling_points">핵심 장점</label><textarea id="selling_points" name="selling_points" className="textarea" defaultValue={Array.isArray(product.selling_points) ? product.selling_points.join("\n") : ""} placeholder="한 줄에 하나씩 입력" /></div>
          <div className="field"><label htmlFor="usage_tips">활용 팁</label><textarea id="usage_tips" name="usage_tips" className="textarea" defaultValue={product.usage_tips ?? ""} /></div>
          <div className="field"><label htmlFor="cautions">확인할 점</label><textarea id="cautions" name="cautions" className="textarea" defaultValue={product.cautions ?? ""} /></div>
          <div className="field"><label htmlFor="short_video_url">15초 쇼츠 URL</label><input id="short_video_url" name="short_video_url" className="input" type="url" defaultValue={product.short_video_url ?? ""} /></div>
          <div className="field"><label htmlFor="long_video_url">상세 쇼츠 URL</label><input id="long_video_url" name="long_video_url" className="input" type="url" defaultValue={product.long_video_url ?? ""} /></div>
          <div className="field"><label htmlFor="review_url">블로그 리뷰 URL</label><input id="review_url" name="review_url" className="input" type="url" defaultValue={product.review_url ?? ""} /></div>
          <div className="field"><label htmlFor="status">운영 상태</label><select id="status" name="status" className="select" defaultValue={product.status ?? "draft"}><option value="draft">초안</option><option value="review">검토 대기</option><option value="published">공개</option><option value="paused">일시중지</option><option value="sold_out">품절</option><option value="link_error">링크 오류</option></select></div>
          <div className="field"><label htmlFor="link_status">링크 상태</label><select id="link_status" name="link_status" className="select" defaultValue={product.link_status ?? "unchecked"}><option value="unchecked">미확인</option><option value="healthy">정상</option><option value="broken">오류</option><option value="sold_out">품절</option></select></div>
          <label className="field"><span>공개 상품관 노출</span><input name="is_public" type="checkbox" defaultChecked={Boolean(product.is_public)} /> 공개 상태와 함께 체크해야 방문자에게 보입니다.</label>
          <label className="field"><span>대표 추천 상품</span><input name="is_featured" type="checkbox" defaultChecked={Boolean(product.is_featured)} /> 목록 상단에 우선 노출합니다.</label>
          <div className="actions" style={{ marginTop: 0 }}><button className="button button-primary" type="submit">변경 내용 저장</button><DeleteProductButton id={id} /></div>
        </form></div></>);
}
