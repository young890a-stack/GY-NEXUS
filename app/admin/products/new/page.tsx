"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const form = new FormData(event.currentTarget);
      const payload = {
        title: String(form.get("title") || "").trim(),
        description: String(form.get("description") || "").trim(),
        image_url: String(form.get("image_url") || "").trim() || null,
        affiliate_url: String(form.get("affiliate_url") || "").trim(),
        platform: String(form.get("platform") || "etc"),
        price_text: String(form.get("price_text") || "").trim() || null,
      };

      if (!payload.title || !payload.affiliate_url) {
        throw new Error("상품명과 제휴 링크는 필수입니다.");
      }

      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(data.message || "상품 등록에 실패했습니다.");

      router.push("/admin/products");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "상품 등록에 실패했습니다.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="admin-top">
        <div><h1>새 상품 등록</h1><p>상품 정보와 제휴 링크를 입력하세요.</p></div>
        <Link className="button button-light" href="/admin/products">← 목록으로</Link>
      </div>
      <div className="card form-card">
        {message && <div className="alert alert-error" style={{ marginBottom: 18 }}>{message}</div>}
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field"><label htmlFor="title">상품명 *</label><input id="title" name="title" className="input" required placeholder="예: 고속충전 보조배터리" /></div>
          <div className="field"><label htmlFor="description">상품 설명</label><textarea id="description" name="description" className="textarea" placeholder="주요 특징과 추천 대상을 입력하세요." /></div>
          <div className="field"><label htmlFor="price_text">가격 표시</label><input id="price_text" name="price_text" className="input" placeholder="예: 19,900원" /></div>
          <div className="field"><label htmlFor="image_url">상품 이미지 URL</label><input id="image_url" name="image_url" className="input" type="url" placeholder="https://..." /><span className="help">이미지 URL을 입력하세요. Supabase Storage 업로드는 후속 고급 기능으로 연결할 수 있습니다.</span></div>
          <div className="field"><label htmlFor="affiliate_url">제휴 링크 *</label><input id="affiliate_url" name="affiliate_url" className="input" type="url" required placeholder="https://link.coupang.com/..." /></div>
          <div className="field"><label htmlFor="platform">플랫폼</label><select id="platform" name="platform" className="select" defaultValue="coupang"><option value="coupang">쿠팡</option><option value="temu">테무</option><option value="naver">네이버</option><option value="etc">기타</option></select></div>
          <button className="button button-primary" type="submit" disabled={loading}>{loading ? "등록 중..." : "상품 등록하기"}</button>
        </form>
      </div>
    </>
  );
}
