"use client";

import Link from "next/link";
import { useState } from "react";

type ImportedProduct = {
  sourceUrl: string;
  resolvedUrl: string;
  platform: string;
  title: string;
  description: string;
  imageUrl: string;
  priceText: string;
  currency: string;
  extractionStatus: "complete" | "partial" | "manual";
  extractionMethod?: "metadata" | "redirect-only" | "manual";
  blockedReason?: string;
  confidence?: { title: number; description: number; image: number; price: number };
};

type CampaignResult = {
  campaign: { id: string; blog_title: string; blog_html: string; shorts_title: string; shorts_description: string; hashtags: string[] };
  dna: {
    oneLineValue: string;
    targetPersona: string;
    coreBenefits: string[];
    riskClaimsToAvoid: string[];
    campaignConcept: string;
    thumbnailHeadline: string;
  };
  imageUrl: string;
  videoProject: { id: string; title: string };
};

const styleOptions = [
  ["million-view", "조회수형", "강한 훅과 문제 해결 중심"],
  ["cinematic", "영화형", "시네마틱 제품 광고"],
  ["emotional", "감성형", "공감과 브랜드 분위기"],
  ["premium", "프리미엄형", "고급스럽고 신뢰감 있게"],
  ["ugc", "후기형 UGC", "생활 속 자연스러운 사용기"],
] as const;

const platformLabels: Record<string, string> = {
  coupang: "쿠팡",
  temu: "Temu",
  "naver-smartstore": "네이버 스마트스토어",
  "11st": "11번가",
  aliexpress: "AliExpress",
  amazon: "Amazon",
  other: "일반 쇼핑몰",
};

export default function ProductDNAStudio() {
  const [url, setUrl] = useState("");
  const [product, setProduct] = useState<ImportedProduct | null>(null);
  const [form, setForm] = useState({
    productName: "",
    productDescription: "",
    manualImageUrl: "",
    priceText: "",
    duration: 25 as 20 | 25 | 30,
    style: "million-view",
    targetAudience: "20~40대 직장인과 실용적인 소비자",
  });
  const [busy, setBusy] = useState<"import" | "campaign" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CampaignResult | null>(null);

  async function importLink(manual = false) {
    setBusy("import"); setError(""); setMessage(""); setResult(null);
    try {
      const response = await fetch("/api/product-dna/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, manual }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "링크 분석 실패");
      setProduct(data.product);
      setForm((current) => ({
        ...current,
        productName: data.product.title || "",
        productDescription: data.product.description || "",
        manualImageUrl: data.product.imageUrl || "",
        priceText: data.product.priceText || "",
      }));
      setMessage(data.needsManualInput
        ? "쇼핑몰이 자동 읽기를 제한했지만 제휴링크는 보존했습니다. 상품명과 이미지 등 비어 있는 항목만 입력하면 계속 진행할 수 있습니다."
        : data.product.extractionStatus === "complete"
          ? "상품 정보가 자동으로 채워졌습니다."
          : "일부 정보만 확인했습니다. 비어 있는 항목을 직접 보완해주세요.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "상품 링크를 분석하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function createCampaign() {
    if (!product) return;
    setBusy("campaign"); setError(""); setMessage(""); setResult(null);
    try {
      const response = await fetch("/api/product-dna/campaign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...product,
          ...form,
          priceText: form.priceText,
          duration: Number(form.duration),
          affiliateDisclosure: "이 콘텐츠에는 제휴 링크가 포함될 수 있으며 구매 시 일정 수수료를 받을 수 있습니다.",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "캠페인 생성 실패");
      setResult(data);
      setMessage("새 광고 이미지, 블로그, 쇼츠 기획과 멀티샷 영상 프로젝트가 완성되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "캠페인을 만들지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  return <div className="dna-stack">
    <section className="panel dna-hero">
      <div>
        <div className="eyebrow">SPRINT 11.5 · UNIVERSAL PRODUCT IMPORT ENGINE</div>
        <h1>어떤 상품이든 링크·이미지·상품명으로 시작</h1>
        <p>쿠팡, Temu, 스마트스토어, 11번가, AliExpress와 일반 쇼핑몰을 자동 감지합니다. 쇼핑몰이 자동 읽기를 막아도 직접 입력 모드로 즉시 전환해 콘텐츠 제작이 멈추지 않습니다.</p>
      </div>
      <div className="dna-shield"><strong>11.5</strong><span>정책 준수형 가져오기</span></div>
    </section>

    <section className="panel dna-import">
      <div className="dna-section-head">
        <div><span className="eyebrow">STEP 1</span><h2>제휴링크 또는 상품 URL 입력</h2></div>
        <span className="dna-safe-label">쿠팡 · Temu · 스마트스토어 · 11번가 · AliExpress</span>
      </div>
      <div className="dna-url-row">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="제휴링크 또는 상품 URL을 붙여넣으세요"/>
        <button className="button button-primary" onClick={() => importLink(false)} disabled={busy !== null || !url.trim()}>{busy === "import" ? "상품 확인 중..." : "상품 정보 가져오기"}</button>
      </div>
      <div className="dna-import-actions">
        <button className="button button-light" onClick={() => importLink(true)} disabled={busy !== null || !url.trim()}>자동 읽기 없이 직접 입력</button>
        {url.trim() && <a className="button button-light" href={url} target="_blank" rel="noreferrer">원본 상품 페이지 열기</a>}
      </div>
      <p className="dna-help">공식 API·허용된 피드·공개 메타데이터를 우선합니다. 접근 제한을 우회하지 않으며, HTTP 403이나 정보 부족 시 제휴링크를 보존한 채 직접 입력 화면으로 전환합니다.</p>
    </section>

    {product && <div className="dna-layout">
      <section className="panel dna-product-card">
        <div className="dna-section-head">
          <div><span className="eyebrow">STEP 2</span><h2>상품 정보 확인</h2></div>
          <span className={`dna-status ${product.extractionStatus}`}>{product.extractionStatus === "manual" ? "직접 입력" : product.extractionStatus}</span>
        </div>
        {product.blockedReason && <div className="dna-fallback-note"><b>자동 추출 안내</b><p>{product.blockedReason}</p></div>}
        {(form.manualImageUrl || product.imageUrl) && <img className="dna-source-preview" src={form.manualImageUrl || product.imageUrl} alt="상품 참고 이미지"/>}
        <label>상품명 *<input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} placeholder="원본 페이지에서 상품명을 복사해 넣으세요"/></label>
        <label>상품 설명 *<textarea rows={6} value={form.productDescription} onChange={(e) => setForm({ ...form, productDescription: e.target.value })} placeholder="핵심 기능, 사용 상황, 확인된 장점을 입력하세요"/></label>
        <label>참고 이미지 URL<input value={form.manualImageUrl} onChange={(e) => setForm({ ...form, manualImageUrl: e.target.value })} placeholder="상품 이미지 주소 또는 직접 업로드한 이미지 URL"/></label>
        <label>가격 정보(선택)<input value={form.priceText} onChange={(e) => setForm({ ...form, priceText: e.target.value })} placeholder="확인된 가격만 입력하세요"/></label>
        <div className="dna-meta">
          <span>플랫폼 <b>{platformLabels[product.platform] || product.platform}</b></span>
          <span>가져오기 방식 <b>{product.extractionMethod || "manual"}</b></span>
          <span>제휴링크 <b>보존됨</b></span>
        </div>
        {product.confidence && <div className="dna-confidence">
          <b>AI 정보 신뢰도</b>
          {Object.entries(product.confidence).map(([key, value]) => <div key={key}><span>{key}</span><progress max="100" value={value}/><strong>{value}%</strong></div>)}
        </div>}
        <div className="dna-rights-note"><b>안전한 재창작 기준</b><p>참고 이미지는 상품 확인용입니다. 새 이미지 생성 시 원본의 배경, 인물, 로고, 문구, 사진 구도를 복제하지 않습니다. 확인되지 않은 가격·효능·인증·후기는 콘텐츠에 넣지 않습니다.</p></div>
      </section>

      <section className="panel dna-settings">
        <div className="dna-section-head"><div><span className="eyebrow">STEP 3</span><h2>콘텐츠 방향 선택</h2></div></div>
        <label>타깃 고객<input value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}/></label>
        <b className="dna-label">영상 길이</b><div className="choice-row">{([20,25,30] as const).map((duration) => <button key={duration} className={form.duration === duration ? "selected" : ""} onClick={() => setForm({ ...form, duration })}>{duration}초</button>)}</div>
        <b className="dna-label">캠페인 스타일</b><div className="dna-style-grid">{styleOptions.map(([value, label, description]) => <button key={value} className={form.style === value ? "active" : ""} onClick={() => setForm({ ...form, style: value })}><strong>{label}</strong><small>{description}</small></button>)}</div>
        <div className="dna-output-list"><b>한 번에 생성</b><span>신규 광고 이미지</span><span>썸네일 문구</span><span>정보형 블로그</span><span>쇼츠 제목·설명·해시태그</span><span>{form.duration}초 멀티샷 영상 기획</span></div>
        <button className="button button-primary dna-generate" onClick={createCampaign} disabled={busy !== null || !form.productName.trim() || !form.productDescription.trim()}>{busy === "campaign" ? "Dream Y가 재창작 중..." : "Product DNA 캠페인 만들기"}</button>
      </section>
    </div>}

    {message && <p className="panel success-text dna-message">{message}</p>}
    {error && <p className="panel error-text dna-message">{error}</p>}

    {result && <section className="panel dna-result">
      <div className="dna-section-head"><div><span className="eyebrow">CAMPAIGN READY</span><h2>{result.dna.campaignConcept}</h2></div><Link className="button button-primary" href="/admin/creative-studio-pro">영상 장면 생성으로 이동</Link></div>
      <div className="dna-result-grid">
        <article className="dna-image-result"><img src={result.imageUrl} alt="AI가 새롭게 제작한 광고 이미지"/><div><b>썸네일 문구</b><strong>{result.dna.thumbnailHeadline}</strong></div></article>
        <article className="dna-summary"><span>한 줄 가치</span><h3>{result.dna.oneLineValue}</h3><span>타깃</span><p>{result.dna.targetPersona}</p><span>핵심 장점</span><ul>{result.dna.coreBenefits.map((item) => <li key={item}>{item}</li>)}</ul><span>사용 금지 주장</span><ul>{result.dna.riskClaimsToAvoid.map((item) => <li key={item}>{item}</li>)}</ul></article>
      </div>
      <div className="dna-content-grid"><article><span className="eyebrow">BLOG</span><h3>{result.campaign.blog_title}</h3><details><summary>블로그 원고 확인</summary><div className="dna-blog-preview" dangerouslySetInnerHTML={{ __html: result.campaign.blog_html }}/></details></article><article><span className="eyebrow">SHORTS</span><h3>{result.campaign.shorts_title}</h3><p>{result.campaign.shorts_description}</p><div className="dna-tags">{result.campaign.hashtags.map((tag) => <span key={tag}>{tag.startsWith("#") ? tag : `#${tag}`}</span>)}</div></article></div>
    </section>}
  </div>;
}
