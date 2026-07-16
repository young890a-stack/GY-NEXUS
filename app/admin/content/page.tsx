"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ContentKind = "blog" | "shorts" | "bundle";

type Product = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  affiliate_url?: string | null;
  created_at?: string | null;
};

type GenerateResponse = {
  success?: boolean;
  content?: string;
  blog?: string;
  shorts?: string;
  result?: string;
  output?: string;
  message?: string;
  error?: string;
};

function getProductTitle(product: Product): string {
  return product.title?.trim() || "이름 없는 상품";
}

function getGeneratedText(data: GenerateResponse): string {
  return (
    data.content?.trim() ||
    data.result?.trim() ||
    data.output?.trim() ||
    data.blog?.trim() ||
    data.shorts?.trim() ||
    ""
  );
}

function getKindLabel(kind: ContentKind): string {
  if (kind === "blog") {
    return "블로그";
  }

  if (kind === "shorts") {
    return "15초 쇼츠";
  }

  return "전체 패키지";
}

export default function AdminContentPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [kind, setKind] = useState<ContentKind>("bundle");

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedProduct = useMemo(() => {
    return (
      products.find((product) => product.id === selectedProductId) ?? null
    );
  }, [products, selectedProductId]);

  useEffect(() => {
    void loadProducts();
  }, []);

  async function loadProducts() {
    setLoadingProducts(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("products")
        .select(
          "id, title, description, image_url, affiliate_url, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const productList: Product[] = Array.isArray(data)
        ? (data as Product[])
        : [];

      setProducts(productList);

      if (productList.length > 0) {
        setSelectedProductId((currentId) => {
          const currentProductExists = productList.some(
            (product) => product.id === currentId
          );

          return currentProductExists
            ? currentId
            : productList[0].id;
        });
      } else {
        setSelectedProductId("");
        setErrorMessage(
          "등록된 상품이 없습니다. 먼저 상품 관리에서 상품을 등록해주세요."
        );
      }
    } catch (error) {
      console.error("상품 불러오기 오류:", error);

      setProducts([]);
      setSelectedProductId("");

      setErrorMessage(
        error instanceof Error
          ? `상품 목록을 불러오지 못했습니다: ${error.message}`
          : "상품 목록을 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingProducts(false);
    }
  }

  async function generateContent() {
    if (!selectedProduct) {
      setErrorMessage("콘텐츠를 생성할 상품을 먼저 선택해주세요.");
      setMessage("");
      return;
    }

    const title = getProductTitle(selectedProduct);
    const description =
      selectedProduct.description?.trim() || "상품 설명이 없습니다.";

    setGenerating(true);
    setContent("");
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          product_id: selectedProduct.id,

          title,
          description,

          kind,
          type: kind,
          contentType: kind,

          imageUrl: selectedProduct.image_url ?? "",
          image_url: selectedProduct.image_url ?? "",

          affiliateUrl: selectedProduct.affiliate_url ?? "",
          affiliate_url: selectedProduct.affiliate_url ?? "",
        }),
      });

      const data = (await response
        .json()
        .catch(() => ({}))) as GenerateResponse;

      if (!response.ok || data.success === false) {
        throw new Error(
          data.message ||
            data.error ||
            `AI 콘텐츠 생성에 실패했습니다. (${response.status})`
        );
      }

      const generatedText = getGeneratedText(data);

      if (!generatedText) {
        throw new Error(
          "서버 응답은 성공했지만 생성된 콘텐츠가 비어 있습니다."
        );
      }

      setContent(generatedText);

      setMessage(
        data.message || "콘텐츠 생성과 Supabase 저장이 완료되었습니다."
      );
    } catch (error) {
      console.error("AI 콘텐츠 생성 오류:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "AI 콘텐츠 생성 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function copyAllContent() {
    if (!content.trim()) {
      setErrorMessage("복사할 콘텐츠가 없습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(content);

      setMessage("생성된 콘텐츠 전체를 복사했습니다.");
      setErrorMessage("");
    } catch (error) {
      console.error("클립보드 복사 오류:", error);

      setErrorMessage(
        "자동 복사에 실패했습니다. 결과 내용을 직접 선택해주세요."
      );
    }
  }

  function saveAsFile() {
    if (!content.trim()) {
      setErrorMessage("저장할 콘텐츠가 없습니다.");
      return;
    }

    const productTitle = selectedProduct
      ? getProductTitle(selectedProduct)
      : "content";

    const safeTitle = productTitle
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);

    const date = new Date().toISOString().slice(0, 10);
    const fileName = `${safeTitle}-${kind}-${date}.txt`;

    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(objectUrl);

    setMessage("생성된 콘텐츠를 파일로 저장했습니다.");
    setErrorMessage("");
  }

  return (
    <main className="content-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">GY-NEXUS AI STUDIO</p>

          <h1>AI 콘텐츠 센터</h1>

          <p className="page-description">
            상품 하나로 블로그, 15초 쇼츠, SEO 콘텐츠 패키지를 생성하세요.
          </p>
        </div>

        <a className="history-link" href="/admin/history">
          생성 이력 보기
        </a>
      </section>

      <section className="content-layout">
        <article className="settings-card">
          <div className="section-title">콘텐츠 생성 설정</div>

          <label className="field-label" htmlFor="product-select">
            상품 선택
          </label>

          <div className="select-row">
            <select
              id="product-select"
              className="product-select"
              value={selectedProductId}
              disabled={loadingProducts || products.length === 0}
              onChange={(event) => {
                setSelectedProductId(event.target.value);
                setContent("");
                setMessage("");
                setErrorMessage("");
              }}
            >
              {loadingProducts && (
                <option value="">상품 목록을 불러오는 중입니다...</option>
              )}

              {!loadingProducts && products.length === 0 && (
                <option value="">등록된 상품이 없습니다.</option>
              )}

              {!loadingProducts &&
                products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {getProductTitle(product)}
                  </option>
                ))}
            </select>

            <button
              type="button"
              className="refresh-button"
              disabled={loadingProducts}
              onClick={() => void loadProducts()}
            >
              {loadingProducts ? "불러오는 중" : "새로고침"}
            </button>
          </div>

          {selectedProduct && (
            <div className="product-preview">
              {selectedProduct.image_url ? (
                <img
                  className="product-image"
                  src={selectedProduct.image_url}
                  alt={getProductTitle(selectedProduct)}
                />
              ) : (
                <div className="product-image-placeholder">상품</div>
              )}

              <div className="product-information">
                <strong>{getProductTitle(selectedProduct)}</strong>

                <p>
                  {selectedProduct.description?.trim() ||
                    "등록된 상품 설명이 없습니다."}
                </p>
              </div>
            </div>
          )}

          <div className="generate-section">
            <span className="field-label">생성할 콘텐츠</span>

            <button
              type="button"
              className={`kind-button ${
                kind === "blog" ? "kind-button-active" : ""
              }`}
              onClick={() => setKind("blog")}
              disabled={generating}
            >
              <span>📝</span>
              블로그
            </button>

            <button
              type="button"
              className={`kind-button ${
                kind === "shorts" ? "kind-button-active" : ""
              }`}
              onClick={() => setKind("shorts")}
              disabled={generating}
            >
              <span>🎬</span>
              15초 쇼츠
            </button>

            <button
              type="button"
              className={`kind-button ${
                kind === "bundle" ? "kind-button-active" : ""
              }`}
              onClick={() => setKind("bundle")}
              disabled={generating}
            >
              <span>✨</span>
              전체 패키지
            </button>
          </div>

          <button
            type="button"
            className="generate-button"
            onClick={() => void generateContent()}
            disabled={
              generating ||
              loadingProducts ||
              !selectedProduct ||
              products.length === 0
            }
          >
            {generating
              ? "AI가 콘텐츠를 생성하고 있습니다..."
              : `🤖 ${getKindLabel(kind)} 생성하기`}
          </button>

          {message && <div className="success-message">{message}</div>}

          {errorMessage && (
            <div className="error-message">{errorMessage}</div>
          )}
        </article>

        <article className="result-card">
          <div className="result-header">
            <div>
              <div className="section-title">AI 생성 결과</div>

              <p>
                생성된 콘텐츠를 확인하고 복사하거나 파일로 저장하세요.
              </p>
            </div>

            <div className="result-actions">
              <button
                type="button"
                className="action-button"
                onClick={() => void copyAllContent()}
                disabled={!content.trim()}
              >
                📋 전체 복사
              </button>

              <button
                type="button"
                className="action-button action-button-primary"
                onClick={saveAsFile}
                disabled={!content.trim()}
              >
                ⬇ 파일 저장
              </button>
            </div>
          </div>

          <div className="result-box">
            {generating ? (
              <div className="empty-result">
                <div className="loading-spinner" />

                <strong>콘텐츠를 생성하고 있습니다.</strong>

                <p>
                  전체 패키지는 블로그, 쇼츠, SEO 내용을 함께 생성하므로
                  잠시 시간이 걸릴 수 있습니다.
                </p>
              </div>
            ) : content ? (
              <pre className="generated-content">{content}</pre>
            ) : (
              <div className="empty-result">
                <span className="empty-icon">✨</span>

                <strong>아직 생성된 콘텐츠가 없습니다.</strong>

                <p>
                  왼쪽에서 상품과 콘텐츠 종류를 선택한 뒤 생성 버튼을
                  눌러주세요.
                </p>
              </div>
            )}
          </div>
        </article>
      </section>

      <style jsx>{`
        .content-page {
          width: 100%;
          min-height: 100vh;
          padding: 28px 32px 48px;
          background:
            radial-gradient(
              circle at 15% 5%,
              rgba(91, 69, 224, 0.07),
              transparent 25%
            ),
            #f4f7fb;
          color: #172033;
        }

        .page-heading {
          max-width: 1320px;
          margin: 0 auto 24px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #5b45e0;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .page-heading h1 {
          margin: 0;
          font-size: 26px;
          line-height: 1.25;
          letter-spacing: -0.04em;
        }

        .page-description {
          margin: 10px 0 0;
          color: #667085;
          font-size: 15px;
          line-height: 1.7;
        }

        .history-link {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 18px;
          border: 1px solid #e4e7ec;
          border-radius: 13px;
          background: #ffffff;
          color: #172033;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
          box-shadow: 0 8px 20px rgba(16, 24, 40, 0.04);
        }

        .content-layout {
          max-width: 1320px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(330px, 430px) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }

        .settings-card,
        .result-card {
          border: 1px solid #e4e7ec;
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 10px 30px rgba(16, 24, 40, 0.055);
        }

        .settings-card {
          padding: 24px;
        }

        .result-card {
          min-width: 0;
          padding: 24px;
        }

        .section-title {
          margin-bottom: 12px;
          color: #172033;
          font-size: 15px;
          font-weight: 900;
        }

        .field-label {
          display: block;
          margin-bottom: 9px;
          color: #172033;
          font-size: 14px;
          font-weight: 850;
        }

        .select-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
        }

        .product-select {
          width: 100%;
          min-width: 0;
          height: 47px;
          padding: 0 14px;
          border: 1px solid #d8dee9;
          border-radius: 12px;
          background: #ffffff;
          color: #172033;
          font-size: 14px;
          outline: none;
        }

        .product-select:focus {
          border-color: #6c5ce7;
          box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.12);
        }

        .refresh-button {
          min-width: 86px;
          padding: 0 12px;
          border: 1px solid #d8dee9;
          border-radius: 12px;
          background: #ffffff;
          color: #344054;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .refresh-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .product-preview {
          margin-top: 14px;
          padding: 14px;
          display: flex;
          gap: 13px;
          align-items: center;
          border: 1px solid #eef0f4;
          border-radius: 14px;
          background: #f7f8fc;
        }

        .product-image,
        .product-image-placeholder {
          flex-shrink: 0;
          width: 58px;
          height: 58px;
          border-radius: 12px;
        }

        .product-image {
          object-fit: cover;
          border: 1px solid #eaecf0;
          background: #ffffff;
        }

        .product-image-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ece9ff;
          color: #5b45e0;
          font-size: 12px;
          font-weight: 900;
        }

        .product-information {
          min-width: 0;
        }

        .product-information strong {
          display: block;
          margin-bottom: 5px;
          color: #172033;
          font-size: 15px;
        }

        .product-information p {
          margin: 0;
          display: -webkit-box;
          overflow: hidden;
          color: #667085;
          font-size: 13px;
          line-height: 1.55;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .generate-section {
          margin-top: 22px;
        }

        .kind-button {
          width: 100%;
          min-height: 48px;
          margin-top: 9px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #e0e4eb;
          border-radius: 12px;
          background: #ffffff;
          color: #172033;
          font-size: 14px;
          font-weight: 850;
          cursor: pointer;
          transition:
            border-color 0.16s ease,
            background 0.16s ease,
            transform 0.16s ease;
        }

        .kind-button:hover:not(:disabled) {
          border-color: #6c5ce7;
          transform: translateY(-1px);
        }

        .kind-button-active {
          border-color: #5b45e0;
          background: linear-gradient(135deg, #5b45e0, #5142e8);
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(91, 69, 224, 0.22);
        }

        .kind-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .generate-button {
          width: 100%;
          min-height: 52px;
          margin-top: 20px;
          padding: 12px 18px;
          border: 0;
          border-radius: 13px;
          background: #0f1830;
          color: #ffffff;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(15, 24, 48, 0.18);
        }

        .generate-button:hover:not(:disabled) {
          background: #182341;
        }

        .generate-button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
          box-shadow: none;
        }

        .success-message,
        .error-message {
          margin-top: 14px;
          padding: 13px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 750;
          line-height: 1.55;
        }

        .success-message {
          border: 1px solid #a6f4c5;
          background: #ecfdf3;
          color: #027a48;
        }

        .error-message {
          border: 1px solid #fecdca;
          background: #fef3f2;
          color: #b42318;
        }

        .result-header {
          min-height: 55px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
        }

        .result-header p {
          margin: -5px 0 0;
          color: #667085;
          font-size: 13px;
          line-height: 1.6;
        }

        .result-actions {
          flex-shrink: 0;
          display: flex;
          gap: 8px;
        }

        .action-button {
          min-height: 42px;
          padding: 0 14px;
          border: 1px solid #e0e4eb;
          border-radius: 11px;
          background: #ffffff;
          color: #172033;
          font-size: 13px;
          font-weight: 850;
          cursor: pointer;
        }

        .action-button-primary {
          border-color: #5b45e0;
          background: #5b45e0;
          color: #ffffff;
        }

        .action-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .result-box {
          min-height: 570px;
          max-height: calc(100vh - 245px);
          margin-top: 16px;
          overflow: auto;
          border: 1px solid #e4e7ec;
          border-radius: 15px;
          background: #fbfcfe;
        }

        .generated-content {
          min-height: 100%;
          margin: 0;
          padding: 22px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          color: #202939;
          font-family:
            Pretendard, "Noto Sans KR", system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 14px;
          line-height: 1.85;
        }

        .empty-result {
          min-height: 570px;
          padding: 40px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #667085;
        }

        .empty-result strong {
          margin-top: 14px;
          color: #344054;
          font-size: 16px;
        }

        .empty-result p {
          max-width: 430px;
          margin: 9px 0 0;
          font-size: 13px;
          line-height: 1.7;
        }

        .empty-icon {
          font-size: 34px;
        }

        .loading-spinner {
          width: 34px;
          height: 34px;
          border: 4px solid #e6e8ee;
          border-top-color: #5b45e0;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1050px) {
          .content-layout {
            grid-template-columns: 1fr;
          }

          .result-box {
            max-height: none;
          }
        }

        @media (max-width: 720px) {
          .content-page {
            padding: 20px 15px 36px;
          }

          .page-heading {
            flex-direction: column;
          }

          .history-link {
            width: 100%;
          }

          .settings-card,
          .result-card {
            padding: 18px;
          }

          .result-header {
            flex-direction: column;
          }

          .result-actions {
            width: 100%;
          }

          .action-button {
            flex: 1;
          }

          .select-row {
            grid-template-columns: 1fr;
          }

          .refresh-button {
            min-height: 42px;
          }
        }
      `}</style>
    </main>
  );
}