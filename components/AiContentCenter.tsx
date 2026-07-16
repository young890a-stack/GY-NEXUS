"use client";

import { useMemo, useState } from "react";

type Product = {
  id: string;
  title: string;
  description: string | null;
};

type ContentType = "blog" | "shorts" | "package";

type Props = {
  products: Product[];
};

const contentTypeLabels: Record<ContentType, string> = {
  blog: "블로그",
  shorts: "15초 쇼츠",
  package: "전체 패키지",
};

export default function AiContentCenter({ products }: Props) {
  const [selectedProductId, setSelectedProductId] = useState(
    products[0]?.id ?? ""
  );
  const [contentType, setContentType] =
    useState<ContentType>("package");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );

  async function generateContent() {
    if (!selectedProduct) {
      setMessage("먼저 상품을 선택하세요.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setResult("");
      setCopied(false);

      const response = await fetch("/api/ai/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          title: selectedProduct.title,
          description: selectedProduct.description ?? "",
          contentType,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "AI 콘텐츠 생성에 실패했습니다.");
      }

      setResult(data.content);

      if (data.saveWarning) {
        setMessage(
          `콘텐츠 생성은 완료됐지만 저장에 실패했습니다: ${data.saveWarning}`
        );
      } else {
        setMessage("콘텐츠 생성과 Supabase 저장이 완료됐습니다.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "콘텐츠를 생성하지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("자동 복사에 실패했습니다. 내용을 직접 선택해 복사하세요.");
    }
  }

  function downloadText() {
    if (!result || !selectedProduct) return;

    const blob = new Blob([result], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${selectedProduct.title}-${contentTypeLabels[contentType]}.txt`;
    link.click();

    URL.revokeObjectURL(url);
  }

  if (!products.length) {
    return (
      <div className="panel">
        <div className="empty">
          등록된 상품이 없습니다. 상품을 먼저 등록한 뒤 콘텐츠를
          생성하세요.
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: "minmax(300px, 0.75fr) minmax(0, 1.25fr)",
        alignItems: "start",
      }}
    >
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>콘텐츠 생성 설정</h2>

        <label
          htmlFor="product"
          style={{
            display: "block",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          상품 선택
        </label>

        <select
          id="product"
          value={selectedProductId}
          onChange={(event) => setSelectedProductId(event.target.value)}
          disabled={loading}
          style={{
            width: "100%",
            minHeight: 48,
            padding: "0 14px",
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "white",
            fontSize: 15,
          }}
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.title}
            </option>
          ))}
        </select>

        {selectedProduct && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 12,
              background: "var(--soft, #f6f7fb)",
              lineHeight: 1.65,
            }}
          >
            <b>{selectedProduct.title}</b>
            <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
              {selectedProduct.description || "등록된 상품 설명이 없습니다."}
            </p>
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <p style={{ marginBottom: 10, fontWeight: 700 }}>
            생성할 콘텐츠
          </p>

          <div className="grid" style={{ gap: 10 }}>
            {(
              Object.keys(contentTypeLabels) as ContentType[]
            ).map((type) => (
              <button
                key={type}
                type="button"
                className={
                  contentType === type
                    ? "button button-primary"
                    : "button button-light"
                }
                onClick={() => setContentType(type)}
                disabled={loading}
              >
                {type === "blog" && "📝 "}
                {type === "shorts" && "🎬 "}
                {type === "package" && "✨ "}
                {contentTypeLabels[type]}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="button button-dark"
          onClick={generateContent}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 22,
            minHeight: 52,
          }}
        >
          {loading
            ? "AI가 콘텐츠를 만들고 있습니다..."
            : `🤖 ${contentTypeLabels[contentType]} 생성하기`}
        </button>

        {message && (
          <div
            className={
              message.includes("실패") || message.includes("못했습니다")
                ? "alert alert-error"
                : "alert"
            }
            style={{ marginTop: 16 }}
          >
            {message}
          </div>
        )}
      </section>

      <section className="panel">
        <div
          className="section-head"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>AI 생성 결과</h2>
            <p style={{ marginBottom: 0 }}>
              생성된 콘텐츠를 확인하고 복사하거나 저장하세요.
            </p>
          </div>

          {result && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="button button-light"
                onClick={copyResult}
              >
                {copied ? "✅ 복사됨" : "📋 전체 복사"}
              </button>

              <button
                type="button"
                className="button button-primary"
                onClick={downloadText}
              >
                ⬇️ 파일 저장
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div
            style={{
              minHeight: 480,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 48 }}>🤖</div>
              <h3>AI가 콘텐츠를 제작하고 있습니다</h3>
              <p style={{ color: "var(--muted)" }}>
                블로그나 전체 패키지는 시간이 조금 걸릴 수 있습니다.
              </p>
            </div>
          </div>
        )}

        {!loading && !result && (
          <div
            className="empty"
            style={{
              minHeight: 480,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
              <b>아직 생성된 콘텐츠가 없습니다.</b>
              <p>왼쪽에서 상품과 콘텐츠 종류를 선택하세요.</p>
            </div>
          </div>
        )}

        {!loading && result && (
          <pre
            style={{
              minHeight: 480,
              maxHeight: 720,
              overflow: "auto",
              margin: 0,
              padding: 22,
              border: "1px solid var(--line)",
              borderRadius: 14,
              background: "#fbfcff",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "inherit",
              fontSize: 15,
              lineHeight: 1.8,
            }}
          >
            {result}
          </pre>
        )}
      </section>
    </div>
  );
}