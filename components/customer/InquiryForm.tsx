"use client";

import { FormEvent, useState } from "react";

const categories = [
  "쇼핑 쇼츠 제작",
  "상품 광고 영상",
  "유튜브·인스타 운영 대행",
  "상품 판매·제휴 협업",
  "기타 문의",
];

export default function InquiryForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [category, setCategory] = useState(categories[0]);
  const [brand, setBrand] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [budget, setBudget] = useState("상담 후 결정");
  const [deadline, setDeadline] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const subject = `[광고대행] ${category}${brand.trim() ? ` · ${brand.trim()}` : ""}`;
    const structuredBody = [
      `문의 유형: ${category}`,
      `브랜드/상품명: ${brand.trim() || "미입력"}`,
      `상품 또는 참고 링크: ${productUrl.trim() || "미입력"}`,
      `예산: ${budget}`,
      `희망 일정: ${deadline || "협의"}`,
      "",
      "상세 요청:",
      body.trim(),
    ].join("\n");

    const response = await fetch("/api/customer/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, subject, body: structuredBody }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error || "문의를 등록하지 못했습니다.");
    } else {
      setMessage("광고 제작 문의가 접수되었습니다. 확인 후 안내드리겠습니다.");
      setBrand("");
      setProductUrl("");
      setDeadline("");
      setBody("");
    }
    setLoading(false);
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="field">
        <label htmlFor="inquiryCategory">문의 유형</label>
        <select id="inquiryCategory" className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="inquiryBrand">브랜드 또는 상품명</label>
        <input id="inquiryBrand" className="input" value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="예: 손선풍기, 생활용품 브랜드" />
      </div>
      <div className="field">
        <label htmlFor="inquiryEmail">답변받을 이메일</label>
        <input id="inquiryEmail" className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="inquiryProductUrl">상품·스토어·참고영상 링크</label>
        <input id="inquiryProductUrl" className="input" type="url" value={productUrl} onChange={(event) => setProductUrl(event.target.value)} placeholder="https://..." />
      </div>
      <div className="field">
        <label htmlFor="inquiryBudget">예상 예산</label>
        <select id="inquiryBudget" className="select" value={budget} onChange={(event) => setBudget(event.target.value)}>
          <option>상담 후 결정</option>
          <option>10만원 미만</option>
          <option>10만~30만원</option>
          <option>30만~50만원</option>
          <option>50만원 이상</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="inquiryDeadline">희망 완료일</label>
        <input id="inquiryDeadline" className="input" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="inquiryBody">원하는 영상 방향과 판매 목표</label>
        <textarea id="inquiryBody" className="input textarea" value={body} onChange={(event) => setBody(event.target.value)} minLength={5} maxLength={3000} required placeholder="타깃 고객, 강조할 장점, 원하는 분위기, 영상 길이 등을 적어주세요." />
      </div>
      <button className="button button-primary" disabled={loading}>{loading ? "접수 중..." : "광고 제작 문의 접수"}</button>
      {message && <div className="notice">{message}</div>}
    </form>
  );
}
