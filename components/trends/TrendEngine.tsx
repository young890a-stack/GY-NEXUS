"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RichAnalysis = {
  confidence?: number;
  features?: string[];
  advantages?: string[];
  useCases?: string[];
  contentAngles?: string[];
};

type Item = {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  platform: string;
  price_text?: string;
  affiliate_url: string;
  ai_score: number;
  ai_summary?: string;
  target_audience?: string;
  selling_points?: string[];
  seo_keywords?: string[];
  shorts_hook?: string;
  caution?: string;
  status: string;
  raw_data?: {
    analysis?: RichAnalysis;
    extraction?: { brand?: string; category?: string; evidence?: string[] };
    extractionWarning?: string;
  };
};

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`서버 응답을 읽지 못했습니다. HTTP ${response.status}`);
  }
}

function ChipList({ values }: { values?: string[] }) {
  if (!values?.length) return <span className="analysis-empty">확인된 정보가 없습니다.</span>;
  return <div className="analysis-chip-list">{values.map((value) => <span className="analysis-chip" key={value}>{value}</span>)}</div>;
}

export default function TrendEngine({ items }: { items: Item[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());

    setLoading(true);
    setMsg("");
    setLastScore(null);

    try {
      const response = await fetch("/api/trends/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readJson(response);

      if (!response.ok) {
        if (data.needsManualInput) setManualOpen(true);
        throw new Error(String(data.message || "AI 상품 분석에 실패했습니다."));
      }

      const item = data.item as { ai_score?: number } | undefined;
      const warning = String(data.extractionWarning || "");
      setLastScore(item?.ai_score ?? 0);
      setMsg(warning ? `AI 분석은 완료됐지만 자동 추출 알림: ${warning}` : "상품 링크 분석과 AI 평가가 완료되었습니다.");
      form.reset();
      setManualOpen(false);
      router.refresh();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "AI 상품 분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function action(id: string, type: "promote" | "delete") {
    setBusy(id + type);
    setMsg("");
    try {
      const response = await fetch(
        type === "promote" ? `/api/trends/${id}/promote` : `/api/trends/${id}`,
        { method: type === "promote" ? "POST" : "DELETE" },
      );
      const data = await readJson(response);
      if (!response.ok) throw new Error(String(data.message || "요청 처리에 실패했습니다."));
      setMsg(type === "promote" ? "정식 상품으로 등록했습니다." : "후보를 삭제했습니다.");
      router.refresh();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "요청 처리에 실패했습니다.");
    } finally {
      setBusy("");
    }
  }

  const summary = useMemo(() => {
    const analyzed = items.filter((item) => item.status === "analyzed" || item.status === "approved").length;
    const average = items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.ai_score || 0), 0) / items.length) : 0;
    const top = items[0]?.ai_score || 0;
    return { analyzed, average, top };
  }, [items]);

  const success = msg.includes("완료") || msg.includes("등록") || msg.includes("삭제");

  return (
    <>
      <section className="analysis-hero panel">
        <div>
          <span className="eyebrow">GY-NEXUS v7.0 SPRINT 2 · PRODUCT INTELLIGENCE</span>
          <h2>상품 링크 하나로 판매 가능성을 분석합니다</h2>
          <p>페이지에서 상품명·가격·설명·이미지를 추출한 뒤 AI가 특징, 장점, 타깃 고객, SEO 키워드와 콘텐츠 방향을 정리합니다.</p>
        </div>
        <div className="analysis-stats">
          <div><small>분석 상품</small><strong>{summary.analyzed}</strong></div>
          <div><small>평균 점수</small><strong>{summary.average}</strong></div>
          <div><small>최고 점수</small><strong>{summary.top}</strong></div>
        </div>
      </section>

      <section className="panel analysis-form-panel" suppressHydrationWarning>
        {msg && (
          <div className={success ? "alert alert-success" : "alert alert-error"} style={{ marginBottom: 18 }} role="status">
            {msg}{lastScore !== null ? ` (AI 추천점수 ${lastScore}점)` : ""}
          </div>
        )}

        <form className="form-grid" onSubmit={analyze} noValidate={false}>
          <div className="field">
            <label htmlFor="product_url">상품 또는 제휴 링크 *</label>
            <div className="analysis-url-row">
              <input
                id="product_url"
                className="input analysis-url-input"
                name="product_url"
                type="url"
                required
                placeholder="https://... 상품 링크를 붙여넣으세요"
                disabled={loading}
                autoComplete="off"
              />
              <button className="button button-primary" type="submit" disabled={loading || busy !== ""}>
                {loading ? "페이지 추출·AI 분석 중..." : "AI 상품 분석 시작"}
              </button>
            </div>
            <p className="help">쇼핑몰이 자동 수집을 차단하거나 페이지 정보가 부족하면 아래 수동 보완 입력을 사용합니다.</p>
          </div>

          <button className="analysis-manual-toggle" type="button" onClick={() => setManualOpen((value) => !value)} disabled={loading}>
            {manualOpen ? "− 수동 보완 입력 닫기" : "+ 자동 추출이 안 될 때 수동 정보 추가"}
          </button>

          {manualOpen && (
            <div className="analysis-manual-box">
              <div className="grid grid-3">
                <div className="field"><label>상품명</label><input className="input" name="title" disabled={loading} /></div>
                <div className="field"><label>가격</label><input className="input" name="price_text" placeholder="예: 19,900원" disabled={loading} /></div>
                <div className="field"><label>플랫폼</label><select className="select" name="platform" defaultValue=""><option value="">자동 판별</option><option value="coupang">쿠팡</option><option value="temu">테무</option><option value="naver">네이버</option><option value="etc">기타</option></select></div>
              </div>
              <div className="grid grid-3">
                <div className="field"><label>브랜드</label><input className="input" name="brand" disabled={loading} /></div>
                <div className="field"><label>카테고리</label><input className="input" name="category" disabled={loading} /></div>
                <div className="field"><label>이미지 URL</label><input className="input" name="image_url" type="url" disabled={loading} /></div>
              </div>
              <div className="field"><label>상품 설명</label><textarea className="textarea" name="description" placeholder="자동 추출이 부족할 때 핵심 사양과 특징을 입력하세요." disabled={loading} /></div>
              <div className="field"><label>별도 제휴 링크</label><input className="input" name="affiliate_url" type="url" placeholder="원본 상품 URL과 제휴 링크가 다를 때만 입력" disabled={loading} /></div>
            </div>
          )}
        </form>
      </section>

      <section style={{ marginTop: 24 }} className="grid">
        {items.length === 0 ? (
          <div className="panel empty">아직 분석한 상품이 없습니다. 위에 상품 링크를 붙여넣어 첫 분석을 시작하세요.</div>
        ) : (
          items.map((item) => {
            const rich = item.raw_data?.analysis;
            const extracted = item.raw_data?.extraction;
            return (
              <article className="panel analysis-result-card" key={item.id}>
                <div className="analysis-result-head">
                  <div className="analysis-product-identity">
                    {item.image_url ? <img src={item.image_url} alt="" className="analysis-product-image" /> : <div className="analysis-product-image analysis-image-placeholder">상품 이미지</div>}
                    <div>
                      <div className="badges"><span className="badge">{item.platform}</span><span className="badge">{item.status}</span>{item.price_text && <span className="badge">{item.price_text}</span>}</div>
                      <h2>{item.title}</h2>
                      <p>{item.ai_summary || item.description || "분석 내용 없음"}</p>
                      {(extracted?.brand || extracted?.category) && <small className="analysis-source-note">{[extracted.brand, extracted.category].filter(Boolean).join(" · ")}</small>}
                    </div>
                  </div>
                  <div className="analysis-score-wrap">
                    <div className="analysis-score"><small>추천점수</small><strong>{item.ai_score || 0}</strong><span>/100</span></div>
                    <div className="analysis-confidence">정보 신뢰도 {rich?.confidence ?? "-"}</div>
                  </div>
                </div>

                <div className="analysis-detail-grid">
                  <div className="analysis-detail"><h3>확인된 특징</h3><ChipList values={rich?.features} /></div>
                  <div className="analysis-detail"><h3>소비자 장점</h3><ChipList values={rich?.advantages} /></div>
                  <div className="analysis-detail"><h3>추천 대상</h3><p>{item.target_audience || "-"}</p></div>
                  <div className="analysis-detail"><h3>추천 사용 상황</h3><ChipList values={rich?.useCases} /></div>
                  <div className="analysis-detail"><h3>판매 포인트</h3><ChipList values={item.selling_points} /></div>
                  <div className="analysis-detail"><h3>콘텐츠 방향</h3><ChipList values={rich?.contentAngles} /></div>
                </div>

                <div className="analysis-highlight-grid">
                  <div><small>15초 쇼츠 훅</small><strong>{item.shorts_hook || "-"}</strong></div>
                  <div><small>구매 전 확인</small><strong>{item.caution || "-"}</strong></div>
                </div>

                <div className="analysis-keywords"><h3>SEO 핵심 키워드</h3><ChipList values={item.seo_keywords} /></div>

                <div className="product-actions">
                  <button className="button button-success" type="button" disabled={item.status === "approved" || busy !== "" || loading} onClick={() => action(item.id, "promote")}>
                    {item.status === "approved" ? "상품 등록 완료" : busy === item.id + "promote" ? "전환 중..." : "정식 상품으로 전환"}
                  </button>
                  <a className="button button-primary" href={`/admin/content?product=${encodeURIComponent(item.title)}`}>이 상품으로 콘텐츠 만들기</a>
                  <a className="button button-light" href={item.affiliate_url} target="_blank" rel="noreferrer">원본 상품 보기</a>
                  <button className="button button-danger" type="button" disabled={busy !== "" || loading} onClick={() => action(item.id, "delete")}>
                    {busy === item.id + "delete" ? "삭제 중..." : "분석 삭제"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </>
  );
}
