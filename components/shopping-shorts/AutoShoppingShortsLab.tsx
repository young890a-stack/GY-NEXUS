"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./AutoShoppingShortsLab.module.css";

type QualityMetrics = {
  firstThreeSeconds: number;
  sceneConsistency: number;
  productClarity: number;
  koreanNaturalness: number;
  subtitleAccuracy: number;
  purchasePersuasion: number;
  claimSafety: number;
  originality: number;
};

type VariantRow = {
  id: string;
  variant_key: string;
  hook_index: number;
  hook_style: string;
  duration_seconds: number;
  hook: string;
  title: string;
  description: string;
  hashtags: string[];
  script: string;
  cta: string;
  thumbnail: { headline?: string; subline?: string; badge?: string; visualDirection?: string };
  scenes: Array<{ start: number; end: number; visual: string; narration: string; subtitle: string; productVisible: boolean }>;
  srt: string;
  quality_report: {
    approved: boolean;
    score: number;
    metrics: QualityMetrics;
    issues: string[];
    regenerationInstructions: string[];
  };
  quality_score: number;
  quality_status: string;
  regeneration_count: number;
  final_video_url?: string | null;
};

type RunRow = {
  id: string;
  product_name: string;
  product_description: string;
  product_url?: string | null;
  product_image_url?: string | null;
  price_text?: string | null;
  product_analysis: {
    summary?: string;
    keyFeatures?: string[];
    reviewInsights?: string[];
    painPoints?: string[];
    targetAudience?: string;
    sellingPoints?: string[];
    cautions?: string[];
  };
  profit_estimate?: {
    ready?: boolean;
    netProfit?: number;
    netMarginRate?: number;
    commerceEligible?: boolean;
  };
  status: string;
  quality_threshold: number;
  approved_variant_id?: string | null;
  error_message?: string | null;
};

type RunResponse = { success: boolean; run: RunRow; variants: VariantRow[]; message?: string };

const metricLabels: Array<[keyof QualityMetrics, string]> = [
  ["firstThreeSeconds", "첫 3초"],
  ["sceneConsistency", "장면 일관성"],
  ["productClarity", "상품 노출"],
  ["koreanNaturalness", "한국어"],
  ["subtitleAccuracy", "자막"],
  ["purchasePersuasion", "설득력"],
  ["claimSafety", "과장 안전"],
  ["originality", "중복 방지"],
];

const initialForm = {
  url: "",
  name: "",
  description: "",
  imageUrl: "",
  priceText: "",
  reviews: "",
  targetAudience: "",
  sellingPrice: "",
  supplyPrice: "",
  shippingCost: "",
  platformFeeRate: "10",
  adCostPerOrder: "",
  returnReserveRate: "3",
};

async function jsonRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.success === false) {
    throw new Error(String(payload.message || `요청 실패 (${response.status})`));
  }
  return payload as T;
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatMoney(value: number | undefined) {
  return `${Math.round(value || 0).toLocaleString("ko-KR")}원`;
}

export default function AutoShoppingShortsLab() {
  const [form, setForm] = useState(initialForm);
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [run, setRun] = useState<RunRow | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [performance, setPerformance] = useState({
    channel: "youtube",
    views: "",
    impressions: "",
    firstThreeSecondRate: "",
    averageViewPercent: "",
    completionRate: "",
    saves: "",
    shares: "",
    clicks: "",
    orders: "",
    revenue: "",
    adSpend: "",
  });

  const approved = useMemo(() => variants.filter((variant) => variant.quality_status === "approved"), [variants]);
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || approved[0] || variants[0];

  async function loadRun(id: string) {
    const data = await jsonRequest<RunResponse>(`/api/shopping-shorts/runs/${id}`, { cache: "no-store" });
    setRun(data.run);
    setVariants(data.variants);
    setSelectedVariantId(data.run.approved_variant_id || data.variants.find((variant) => variant.quality_status === "approved")?.id || data.variants[0]?.id || "");
  }

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("run");
    if (!id) return;
    setBusy(true);
    loadRun(id).catch((cause) => setError(cause instanceof Error ? cause.message : "결과를 불러오지 못했습니다.")).finally(() => setBusy(false));
  }, []);

  function update(key: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createRun(event: FormEvent) {
    event.preventDefault();
    if (!form.url.trim() && (!form.name.trim() || form.description.trim().length < 10)) {
      setError("상품 URL 하나를 붙여넣거나, 상품명과 확인된 설명을 입력해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("상품을 읽고 한국 소비자 관점으로 분석하고 있습니다.");
    try {
      const data = await jsonRequest<{ runId: string; message: string }>("/api/shopping-shorts/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: {
            url: form.url.trim(),
            name: form.name.trim(),
            description: form.description.trim(),
            imageUrl: form.imageUrl.trim(),
            priceText: form.priceText.trim(),
            reviews: form.reviews.split(/\n+/).map((item) => item.trim()).filter(Boolean),
            targetAudience: form.targetAudience.trim(),
            sellingPrice: Number(form.sellingPrice) || undefined,
            supplyPrice: Number(form.supplyPrice) || undefined,
            shippingCost: Number(form.shippingCost) || undefined,
            platformFeeRate: Number(form.platformFeeRate) || undefined,
            adCostPerOrder: Number(form.adCostPerOrder) || undefined,
            returnReserveRate: Number(form.returnReserveRate) || undefined,
          },
          qualityThreshold: 86,
          maxRegenerations: 2,
        }),
      });
      await loadRun(data.runId);
      window.history.replaceState({}, "", `/admin/auto-shopping-shorts?run=${data.runId}`);
      setMessage(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "자동 제작안을 만들지 못했습니다.");
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  async function savePerformance(event: FormEvent) {
    event.preventDefault();
    if (!run || !selectedVariant) return;
    setBusy(true);
    setError("");
    try {
      const data = await jsonRequest<{ message: string }>(`/api/shopping-shorts/runs/${run.id}/performance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          ...performance,
        }),
      });
      setMessage(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "성과를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>DREAM Y · AUTOMATIC COMMERCE LAB</p>
          <h1>한국형 자동 쇼핑 쇼츠 제작기</h1>
          <p>상품 한 번 입력 → 3개 훅 × 3개 길이 → 품질검수 → 합격안만 MP4 자동 제작</p>
        </div>
        <div className={styles.heroStats}>
          <span><strong>9</strong>개 버전</span>
          <span><strong>8</strong>개 품질 기준</span>
          <span><strong>0</strong>재고 보유</span>
        </div>
      </header>

      <section className={styles.progress}>
        {["상품 분석", "3개 훅", "15·20·30초", "자동 품질검수", "MP4 제작", "성과 학습"].map((item, index) => (
          <div key={item} className={run && index < 4 ? styles.progressDone : ""}>
            <b>{index + 1}</b><span>{item}</span>
          </div>
        ))}
      </section>

      {!run && (
        <form className={styles.inputCard} onSubmit={createRun}>
          <div className={styles.sectionTitle}>
            <div><span>STEP 01</span><h2>상품 주소 하나만 붙여넣으세요</h2></div>
            <em>판매 사이트가 차단하면 상품정보를 직접 보완할 수 있습니다.</em>
          </div>
          <label className={styles.urlField}>
            <span>상품 URL</span>
            <input value={form.url} onChange={(event) => update("url", event.target.value)} placeholder="https:// 상품 주소 또는 제휴 링크" />
          </label>
          <button className={styles.detailToggle} type="button" onClick={() => setShowDetails((current) => !current)}>
            {showDetails ? "추가정보 닫기" : "상품정보·후기·순이익 직접 입력"}
          </button>
          {showDetails && (
            <div className={styles.detailGrid}>
              <label><span>상품명</span><input value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
              <label><span>상품 이미지 URL</span><input value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} /></label>
              <label className={styles.wide}><span>확인된 상품 설명</span><textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={4} /></label>
              <label className={styles.wide}><span>후기 핵심 · 한 줄에 하나</span><textarea value={form.reviews} onChange={(event) => update("reviews", event.target.value)} rows={4} /></label>
              <label><span>판매가</span><input inputMode="numeric" value={form.sellingPrice} onChange={(event) => update("sellingPrice", event.target.value)} /></label>
              <label><span>공급가</span><input inputMode="numeric" value={form.supplyPrice} onChange={(event) => update("supplyPrice", event.target.value)} /></label>
              <label><span>직배송비</span><input inputMode="numeric" value={form.shippingCost} onChange={(event) => update("shippingCost", event.target.value)} /></label>
              <label><span>플랫폼 수수료 %</span><input inputMode="decimal" value={form.platformFeeRate} onChange={(event) => update("platformFeeRate", event.target.value)} /></label>
              <label><span>주문당 광고비</span><input inputMode="numeric" value={form.adCostPerOrder} onChange={(event) => update("adCostPerOrder", event.target.value)} /></label>
              <label><span>반품 충당률 %</span><input inputMode="decimal" value={form.returnReserveRate} onChange={(event) => update("returnReserveRate", event.target.value)} /></label>
            </div>
          )}
          <button className={styles.primary} disabled={busy} type="submit">
            {busy ? "AI가 분석·생성·검수 중입니다…" : "9개 쇼츠 제작안 자동 만들기"}
          </button>
          <p className={styles.safety}>첫 결과는 게시하지 않습니다. 86점과 항목별 최소 기준을 통과한 버전만 자동 영상 제작이 열립니다.</p>
        </form>
      )}

      {message && <div className={styles.notice}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}

      {run && (
        <>
          <section className={styles.resultHead}>
            <div className={styles.productImage}>
              {run.product_image_url
                ? <Image src={run.product_image_url} alt={run.product_name} fill sizes="150px" unoptimized />
                : <span>상품 이미지</span>}
            </div>
            <div>
              <p className={styles.eyebrow}>분석 완료 · {run.status.toUpperCase()}</p>
              <h2>{run.product_name}</h2>
              <p>{run.product_analysis?.summary}</p>
              <div className={styles.tags}>
                {(run.product_analysis?.sellingPoints || []).slice(0, 5).map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
            <div className={styles.scoreBox}>
              <span>품질 합격</span>
              <strong>{approved.length}<small>/9</small></strong>
              <em>기준 {run.quality_threshold}점</em>
            </div>
            {run.profit_estimate?.ready && (
              <div className={run.profit_estimate.commerceEligible ? styles.profitGood : styles.profitWarn}>
                <span>예상 주문당 순이익</span>
                <strong>{formatMoney(run.profit_estimate.netProfit)}</strong>
                <em>순이익률 {run.profit_estimate.netMarginRate}% · {run.profit_estimate.commerceEligible ? "커머스 후보" : "마진 재검토"}</em>
              </div>
            )}
          </section>

          {[1, 2, 3].map((hookIndex) => {
            const group = variants.filter((variant) => variant.hook_index === hookIndex);
            if (!group.length) return null;
            return (
              <section className={styles.hookGroup} key={hookIndex}>
                <div className={styles.hookTitle}>
                  <span>HOOK {hookIndex}</span>
                  <div><h2>{group[0].hook}</h2><p>{group[0].hook_style}</p></div>
                </div>
                <div className={styles.variantGrid}>
                  {group.map((variant) => (
                    <article className={variant.quality_status === "approved" ? styles.variantApproved : styles.variantBlocked} key={variant.id}>
                      <div className={styles.variantTop}>
                        <b>{variant.duration_seconds}초</b>
                        <span>{variant.quality_status === "approved" ? "자동 제작 가능" : "제작 차단"}</span>
                        <strong>{variant.quality_score}점</strong>
                      </div>
                      <h3>{variant.title}</h3>
                      <p className={styles.script}>{variant.script}</p>
                      <div className={styles.metrics}>
                        {metricLabels.map(([key, label]) => (
                          <div key={key}>
                            <span>{label}</span>
                            <i><b style={{ width: `${variant.quality_report?.metrics?.[key] || 0}%` }} /></i>
                            <em>{variant.quality_report?.metrics?.[key] || 0}</em>
                          </div>
                        ))}
                      </div>
                      {variant.regeneration_count > 0 && <p className={styles.regenerated}>기준 미달 후 자동 수정 {variant.regeneration_count}회</p>}
                      {variant.quality_status !== "approved" && (
                        <ul className={styles.issues}>
                          {(variant.quality_report?.issues || []).slice(0, 3).map((issue) => <li key={issue}>{issue}</li>)}
                        </ul>
                      )}
                      <div className={styles.actions}>
                        <button type="button" onClick={() => downloadFile(`${run.product_name}-${variant.variant_key}.srt`, variant.srt, "application/x-subrip")}>SRT 받기</button>
                        <button type="button" onClick={() => downloadFile(`${run.product_name}-${variant.variant_key}.txt`, `${variant.title}\n\n${variant.script}\n\n${variant.description}\n\n${variant.hashtags.join(" ")}`, "text/plain")}>게시문 받기</button>
                        {variant.quality_status === "approved" && run.product_image_url ? (
                          <Link className={styles.renderLink} href={`/admin/korean-shorts?run=${run.id}&variant=${variant.id}&autostart=1`}>AI 음성·9:16 MP4 자동 완성</Link>
                        ) : (
                          <span className={styles.blockedLabel}>
                            {variant.quality_status === "approved" ? "실제 상품 이미지 보완 후 제작" : "품질 보완 후 제작"}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          <section className={styles.performanceCard}>
            <div className={styles.sectionTitle}>
              <div><span>성과 학습</span><h2>업로드 후 실제 반응을 기록하세요</h2></div>
              <em>표본이 쌓이면 다음 상품의 훅과 길이 선택에 자동 반영됩니다.</em>
            </div>
            <form onSubmit={savePerformance}>
              <label><span>영상 버전</span><select value={selectedVariant?.id || ""} onChange={(event) => setSelectedVariantId(event.target.value)}>{variants.map((variant) => <option value={variant.id} key={variant.id}>{variant.variant_key} · {variant.title}</option>)}</select></label>
              <label><span>채널</span><select value={performance.channel} onChange={(event) => setPerformance((current) => ({ ...current, channel: event.target.value }))}><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="manual">직접 기록</option></select></label>
              {[
                ["views", "조회수"], ["impressions", "노출수"], ["firstThreeSecondRate", "3초 유지율 %"],
                ["averageViewPercent", "평균 시청률 %"], ["completionRate", "완주율 %"], ["saves", "저장"],
                ["shares", "공유"], ["clicks", "링크 클릭"], ["orders", "주문"], ["revenue", "매출"], ["adSpend", "광고비"],
              ].map(([key, label]) => (
                <label key={key}><span>{label}</span><input inputMode="decimal" value={performance[key as keyof typeof performance]} onChange={(event) => setPerformance((current) => ({ ...current, [key]: event.target.value }))} /></label>
              ))}
              <button className={styles.primary} disabled={busy} type="submit">성과 저장·학습 반영</button>
            </form>
          </section>

          <div className={styles.footerActions}>
            <button type="button" onClick={() => { setRun(null); setVariants([]); setMessage(""); setError(""); window.history.replaceState({}, "", "/admin/auto-shopping-shorts"); }}>다른 상품 만들기</button>
            <Link href="/admin/publishing">비공개 게시 대기열 보기</Link>
          </div>
        </>
      )}
    </main>
  );
}
