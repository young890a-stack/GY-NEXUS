"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/types/product";

type Kind = "blog" | "shorts" | "bundle";

const statusLabel: Record<string, string> = {
  draft: "초안", review: "검토 대기", published: "공개", paused: "일시중지", sold_out: "품절", link_error: "링크 오류",
};

export default function ProductCard({ product }: { product: Product }) {
  const [loading, setLoading] = useState<Kind | null>(null);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [message, setMessage] = useState("");
  const clickCount = product.product_clicks?.length ?? 0;

  async function generate(nextKind: Kind) {
    setLoading(nextKind); setKind(nextKind); setContent(""); setMessage("");
    try {
      const response = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: nextKind, title: product.title, description: product.description ?? "" }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "AI 생성에 실패했습니다.");
      setContent(data.content);
    } catch (error) { setMessage(error instanceof Error ? error.message : "AI 생성 중 오류가 발생했습니다."); }
    finally { setLoading(null); }
  }

  async function copyContent() { if (!content) return; await navigator.clipboard.writeText(content); setMessage("전체 내용이 복사되었습니다."); }

  return (
    <article className="card product-card">
      <div className="product-main">
        {product.image_url ? <img className="product-image" src={product.image_url} alt={product.title} /> : <div className="product-image image-placeholder">이미지 없음</div>}
        <div>
          <div className="badges">
            <span className="badge">{product.platform || "기타"}</span>
            <span className="badge">{statusLabel[product.status] || product.status}</span>
            <span className="badge">품질 {product.quality_score ?? 0}점</span>
            <span className="badge">클릭 {clickCount}회</span>
            {product.is_featured && <span className="badge">대표 추천</span>}
          </div>
          <h2>{product.title}</h2>
          <p>{product.description || "등록된 상품 설명이 없습니다."}</p>
          <div className="product-actions">
            <Link className="button button-light" href={`/admin/products/${product.id}/edit`}>✏️ 수정·공개관리</Link>
            {product.slug && product.is_public && product.status === "published" && <Link className="button button-light" href={`/products/${product.slug}`} target="_blank">👁️ 공개페이지</Link>}
            <Link className="button button-light" href={product.slug ? `/go/${product.slug}?source=admin_check` : `/go?id=${product.id}&source=admin_check`} target="_blank">🔗 링크 확인</Link>
            <button className="button button-primary" disabled={Boolean(loading)} onClick={() => generate("blog")}>{loading === "blog" ? "생성 중..." : "📝 블로그"}</button>
            <button className="button button-success" disabled={Boolean(loading)} onClick={() => generate("shorts")}>{loading === "shorts" ? "생성 중..." : "🎬 쇼츠"}</button>
            <button className="button button-dark" disabled={Boolean(loading)} onClick={() => generate("bundle")}>{loading === "bundle" ? "생성 중..." : "✨ 전체 패키지"}</button>
          </div>
        </div>
      </div>
      {message && <div className={`alert ${content ? "alert-success" : "alert-error"}`} style={{ marginTop: 18 }}>{message}</div>}
      {(content || loading) && <div className="ai-result"><div className="ai-toolbar"><b>{kind === "blog" ? "AI 블로그" : kind === "shorts" ? "AI 쇼츠" : "AI 콘텐츠 패키지"}</b><div className="actions" style={{ marginTop: 0 }}><button className="button button-light" onClick={copyContent} disabled={!content}>복사</button><button className="button button-light" onClick={() => { setContent(""); setKind(null); setMessage(""); }}>닫기</button></div></div><div className="ai-output">{loading ? "AI가 콘텐츠를 만들고 있습니다..." : content}</div></div>}
    </article>
  );
}
