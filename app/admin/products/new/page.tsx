"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewProductPage() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [platform, setPlatform] = useState("coupang");
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");

  const [loading, setLoading] = useState(false);

  const handleImageChange = (
  e: React.ChangeEvent<HTMLInputElement>
  ) => {
  if (!e.target.files?.length) return;

  setImageFile(e.target.files[0]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

   let uploadedImageUrl = "";

  if (imageFile) {
  const fileName = `${Date.now()}-${imageFile.name}`;

  const { error: uploadError } = await supabase.storage
    .from("products")
    .upload(fileName, imageFile);

   if (uploadError) {
   console.error(uploadError);
   alert(uploadError.message);

   setLoading(false);
   return;
   }

  const { data } = supabase.storage
    .from("products")
    .getPublicUrl(fileName);

  uploadedImageUrl = data.publicUrl;
  }
   
    const { error } = await supabase.from("products").insert({
      title,
      description,
      price_text: price,
      image_url: uploadedImageUrl,
      affiliate_url: affiliateUrl,
      platform,
    });

    setLoading(false);

    if (error) {
      alert("상품 등록에 실패했습니다.");
      console.error(error);
      return;
    }

    alert("상품이 등록되었습니다.");
    router.push("/admin/products");
    router.refresh();
  };

  return (
    <main style={{ padding: "40px", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>
          + 새 상품 등록
        </h1>
        <p style={{ color: "#666", marginBottom: "30px" }}>
          쿠팡·테무 제휴상품을 등록하는 화면입니다.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <label>
            상품명
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={inputStyle}
              placeholder="예: LG 그램북 AI 15"
            />
          </label>

          <label>
            상품 설명
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              style={{ ...inputStyle, height: "120px" }}
              placeholder="상품 장점과 추천 이유를 입력하세요."
            />
         </label>

           <label>가격</label>
            <input
            type="text"
            placeholder="예: 19900원"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={inputStyle}
            />
          
            <label>
             상품 이미지
            <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={inputStyle}
           />
           </label>

          <label>
            제휴 링크
            <input
              value={affiliateUrl}
              onChange={(e) => setAffiliateUrl(e.target.value)}
              required
              style={inputStyle}
              placeholder="https://link.coupang.com/..."
            />
          </label>

          <label>
            플랫폼
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              style={inputStyle}
            >
              <option value="coupang">쿠팡</option>
              <option value="temu">테무</option>
              <option value="naver">네이버</option>
              <option value="etc">기타</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "10px",
              background: "#111827",
              color: "white",
              padding: "14px",
              borderRadius: "10px",
              border: "none",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {loading ? "등록 중..." : "상품 등록하기"}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "8px",
  padding: "12px",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  fontSize: "15px",
};