"use client";

import Link from "next/link";
import { useState } from "react";

type Product = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  affiliate_url?: string;
  product_clicks?: { id: string }[];
};

type ContentType = "blog" | "shorts" | null;

export default function ProductCard({
  product,
}: {
  product: Product;
}) {
  const [blogLoading, setBlogLoading] = useState(false);
  const [shortsLoading, setShortsLoading] = useState(false);

  const [blogContent, setBlogContent] = useState("");
  const [shortsContent, setShortsContent] = useState("");

  const [selectedContent, setSelectedContent] =
    useState<ContentType>(null);

  const clickCount = product.product_clicks?.length ?? 0;

  async function generateBlog() {
    try {
      setBlogLoading(true);
      setSelectedContent("blog");
      setBlogContent("");

      const response = await fetch("/api/ai/blog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: product.title,
          description: product.description,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.message || "AI 블로그 생성에 실패했습니다.");
        return;
      }

      setBlogContent(data.blog);
    } catch (error) {
      console.error("AI 블로그 생성 오류:", error);
      alert("AI 블로그 생성 중 오류가 발생했습니다.");
    } finally {
      setBlogLoading(false);
    }
  }

  async function generateShorts() {
    try {
      setShortsLoading(true);
      setSelectedContent("shorts");
      setShortsContent("");

      const response = await fetch("/api/ai/shorts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: product.title,
          description: product.description,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.message || "AI 쇼츠 생성에 실패했습니다.");
        return;
      }

      setShortsContent(data.shorts);
    } catch (error) {
      console.error("AI 쇼츠 생성 오류:", error);
      alert("AI 쇼츠 생성 중 오류가 발생했습니다.");
    } finally {
      setShortsLoading(false);
    }
  }

  async function copySelectedContent() {
    try {
      const content =
        selectedContent === "blog"
          ? blogContent
          : selectedContent === "shorts"
            ? shortsContent
            : "";

      if (!content) {
        alert("복사할 내용이 없습니다.");
        return;
      }

      await navigator.clipboard.writeText(content);
      alert("전체 내용이 복사되었습니다!");
    } catch (error) {
      console.error("복사 오류:", error);
      alert("내용을 복사하지 못했습니다.");
    }
  }

  function clearContent() {
    setBlogContent("");
    setShortsContent("");
    setSelectedContent(null);
  }

  const currentContent =
    selectedContent === "blog"
      ? blogContent
      : selectedContent === "shorts"
        ? shortsContent
        : "";

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        padding: "22px",
        borderRadius: "16px",
        marginBottom: "20px",
        background: "#ffffff",
        boxShadow: "0 5px 16px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "22px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.title}
            style={{
              width: "220px",
              maxWidth: "100%",
              height: "170px",
              objectFit: "cover",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
            }}
          />
        )}

        <div
          style={{
            flex: "1",
            minWidth: "260px",
          }}
        >
          <h2
            style={{
              marginTop: "0",
              marginBottom: "10px",
              color: "#111827",
              fontSize: "23px",
            }}
          >
            {product.title}
          </h2>

          <p
            style={{
              color: "#4b5563",
              lineHeight: "1.7",
              marginBottom: "14px",
            }}
          >
            {product.description}
          </p>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 13px",
              borderRadius: "9px",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: "bold",
              marginBottom: "16px",
            }}
          >
            <span>👆 클릭수</span>
            <span>{clickCount}회</span>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Link
              href={`/admin/products/${product.id}/edit`}
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "#f3f4f6",
                color: "#111827",
                textDecoration: "none",
                border: "1px solid #d1d5db",
                fontWeight: "bold",
              }}
            >
              ✏️ 수정
            </Link>

            <Link
              href={`/api/click?id=${product.id}`}
              target="_blank"
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "#ecfdf5",
                color: "#047857",
                textDecoration: "none",
                border: "1px solid #a7f3d0",
                fontWeight: "bold",
              }}
            >
              🔗 상품 링크 확인
            </Link>

            <button
              type="button"
              onClick={generateBlog}
              disabled={blogLoading || shortsLoading}
              style={{
                padding: "11px 15px",
                borderRadius: "8px",
                border: "none",
                background: blogLoading ? "#9ca3af" : "#7c3aed",
                color: "white",
                cursor:
                  blogLoading || shortsLoading
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "bold",
              }}
            >
              {blogLoading
                ? "블로그 생성 중..."
                : "📝 AI 블로그 생성"}
            </button>

            <button
              type="button"
              onClick={generateShorts}
              disabled={shortsLoading || blogLoading}
              style={{
                padding: "11px 15px",
                borderRadius: "8px",
                border: "none",
                background: shortsLoading ? "#9ca3af" : "#dc2626",
                color: "white",
                cursor:
                  shortsLoading || blogLoading
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "bold",
              }}
            >
              {shortsLoading
                ? "쇼츠 생성 중..."
                : "🎬 AI 쇼츠 생성"}
            </button>
          </div>
        </div>
      </div>

      {(blogContent || shortsContent) && (
        <div
          style={{
            marginTop: "24px",
            padding: "20px",
            border: "1px solid #dbeafe",
            borderRadius: "14px",
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            <h3
              style={{
                margin: "0",
                color: "#111827",
                fontSize: "19px",
              }}
            >
              🤖 AI 생성 결과
            </h3>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {blogContent && (
                <button
                  type="button"
                  onClick={() => setSelectedContent("blog")}
                  style={{
                    padding: "9px 13px",
                    borderRadius: "8px",
                    border:
                      selectedContent === "blog"
                        ? "2px solid #7c3aed"
                        : "1px solid #d1d5db",
                    background:
                      selectedContent === "blog"
                        ? "#ede9fe"
                        : "white",
                    color: "#5b21b6",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  📝 블로그 보기
                </button>
              )}

              {shortsContent && (
                <button
                  type="button"
                  onClick={() => setSelectedContent("shorts")}
                  style={{
                    padding: "9px 13px",
                    borderRadius: "8px",
                    border:
                      selectedContent === "shorts"
                        ? "2px solid #dc2626"
                        : "1px solid #d1d5db",
                    background:
                      selectedContent === "shorts"
                        ? "#fee2e2"
                        : "white",
                    color: "#b91c1c",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  🎬 쇼츠 보기
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "16px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={copySelectedContent}
              disabled={!currentContent}
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: "none",
                background: currentContent ? "#111827" : "#9ca3af",
                color: "white",
                cursor: currentContent
                  ? "pointer"
                  : "not-allowed",
                fontWeight: "bold",
              }}
            >
              📋 현재 내용 전체 복사
            </button>

            <button
              type="button"
              onClick={clearContent}
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background: "white",
                color: "#374151",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              🗑 결과 초기화
            </button>
          </div>

          {currentContent ? (
            <div
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: "1.85",
                fontSize: "15px",
                color: "#374151",
                maxHeight: "650px",
                overflowY: "auto",
                padding: "18px",
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
              }}
            >
              {currentContent}
            </div>
          ) : (
            <p
              style={{
                color: "#6b7280",
                margin: "0",
              }}
            >
              생성된 콘텐츠를 선택해주세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}