"use client";

import { useState } from "react";

const sample = `title,description,image_url,affiliate_url,platform,price_text\n샘플 상품,상품 설명,https://example.com/image.jpg,https://example.com,쿠팡,29,900원`;

export default function ImportPage() {
  const [csv, setCsv] = useState(sample);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function upload() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const data = await response.json();
    setMessage(response.ok ? `${data.count}개 상품을 등록했습니다.` : data.message);
    setLoading(false);
  }

  return <>
    <div className="admin-top"><div><h1>상품 자동 등록</h1><p>CSV 형식으로 여러 상품을 한 번에 등록합니다.</p></div></div>
    <section className="panel">
      <textarea className="textarea" style={{ minHeight: 360 }} value={csv} onChange={(e) => setCsv(e.target.value)} />
      <button className="button button-primary" style={{ marginTop: 16 }} onClick={upload} disabled={loading}>{loading ? "등록 중..." : "CSV 일괄 등록"}</button>
      {message && <div className="notice" style={{ marginTop: 16 }}>{message}</div>}
    </section>
  </>;
}
