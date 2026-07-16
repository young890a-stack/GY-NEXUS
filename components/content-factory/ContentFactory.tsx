"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ContentFactoryPackage } from "@/lib/content-factory/types";

type Product = { id: string; title: string; description?: string | null; affiliate_url?: string | null; image_url?: string | null };

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel" style={{ padding: 20, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>;
}

export default function ContentFactory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("20~40대");
  const [duration, setDuration] = useState<15 | 20 | 25 | 30>(20);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ContentFactoryPackage | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from("products").select("id,title,description,affiliate_url,image_url").order("created_at", { ascending: false });
        if (error) throw error;
        const list = (data || []) as Product[];
        setProducts(list);
        if (list[0]) setProductId(list[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "상품 목록을 불러오지 못했습니다.");
      }
    })();
  }, []);

  const product = useMemo(() => products.find((item) => item.id === productId), [products, productId]);

  async function runFactory() {
    const title = product?.title || manualTitle.trim();
    if (!title) { setError("상품을 선택하거나 상품명을 입력해주세요."); return; }
    setLoading(true); setError(""); setMessage(""); setResult(null);
    try {
      const response = await fetch("/api/content-factory/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product?.id,
          title,
          description: product?.description || manualDescription,
          affiliateUrl: product?.affiliate_url || "",
          imageUrl: product?.image_url || "",
          targetAudience,
          shortsDuration: duration,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "콘텐츠 생성에 실패했습니다.");
      setResult(data.result);
      setMessage(data.message || "완료되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "콘텐츠 공장 실행에 실패했습니다.");
    } finally { setLoading(false); }
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setMessage(`${label} 복사 완료`);
  }

  function downloadSrt() {
    if (!result) return;
    const blob = new Blob([result.subtitles.srt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${result.packageTitle.replace(/[\\/:*?"<>|]/g, "_")}.srt`; a.click();
    URL.revokeObjectURL(url);
  }

  return <div>
    <section className="panel" style={{ padding: 22 }}>
      <div className="eyebrow">SPRINT 3 · CONTENT FACTORY</div>
      <h1 style={{ marginBottom: 8 }}>AI 콘텐츠 공장</h1>
      <p style={{ marginTop: 0 }}>상품 하나로 블로그, 쇼츠, 썸네일·이미지 프롬프트, 영상 프롬프트, 검수 자막과 SRT를 한 번에 생성합니다.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 18 }}>
        <label>등록 상품
          <select value={productId} onChange={(e) => setProductId(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
            <option value="">직접 입력</option>
            {products.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <label>타깃
          <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} style={{ width: "100%", marginTop: 6 }} />
        </label>
        <label>쇼츠 길이
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value) as 15 | 20 | 25 | 30)} style={{ width: "100%", marginTop: 6 }}>
            {[15,20,25,30].map((v) => <option key={v} value={v}>{v}초</option>)}
          </select>
        </label>
      </div>

      {!product && <div style={{ marginTop: 14 }}>
        <label>상품명<input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} style={{ width: "100%", marginTop: 6 }} /></label>
        <label style={{ display: "block", marginTop: 10 }}>상품 설명<textarea value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} rows={5} style={{ width: "100%", marginTop: 6 }} /></label>
      </div>}

      <button className="button button-primary" onClick={runFactory} disabled={loading} style={{ marginTop: 18 }}>
        {loading ? "AI 직원들이 제작 중..." : "콘텐츠 패키지 한 번에 생성"}
      </button>
      {message && <p style={{ color: "#15803d" }}>{message}</p>}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
    </section>

    {result && <>
      <Block title={`📌 ${result.packageTitle}`}>
        <p><b>타깃:</b> {result.positioning.targetAudience}</p><p><b>핵심 문제:</b> {result.positioning.coreProblem}</p><p><b>핵심 혜택:</b> {result.positioning.coreBenefit}</p><p><b>추천 각도:</b> {result.positioning.recommendedAngle}</p>
      </Block>
      <Block title="📝 블로그 완성본">
        <h3>{result.blog.seoTitle}</h3><p><b>메타 설명:</b> {result.blog.metaDescription}</p>
        <textarea readOnly value={result.blog.body} rows={22} style={{ width: "100%" }} />
        <p>{result.blog.disclosure}</p><p>{result.blog.hashtags.join(" ")}</p>
        <button className="button button-light" onClick={() => copy(`${result.blog.seoTitle}\n\n${result.blog.body}\n\n${result.blog.disclosure}\n\n${result.blog.hashtags.join(" ")}`, "블로그")}>블로그 전체 복사</button>
      </Block>
      <Block title="🎬 쇼츠 제작 패키지">
        <h3>{result.shorts.title}</h3><p><b>훅:</b> {result.shorts.hook}</p><p><b>전체 음성:</b> {result.shorts.voiceover}</p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th>시간</th><th>화면</th><th>내레이션</th><th>자막</th></tr></thead><tbody>{result.shorts.scenes.map((s, i) => <tr key={i}><td>{s.start}~{s.end}초</td><td>{s.visual}</td><td>{s.narration}</td><td>{s.subtitle}</td></tr>)}</tbody></table></div>
        <p><b>설명:</b> {result.shorts.description}</p><p>{result.shorts.hashtags.join(" ")}</p>
        <button className="button button-light" onClick={() => copy(result.shorts.voiceover, "쇼츠 대본")}>쇼츠 대본 복사</button>
      </Block>
      <Block title="🎨 이미지·썸네일·영상 프롬프트">
        <p><b>썸네일 문구:</b> {result.creative.thumbnailCopy.join(" / ")}</p>
        <h3>썸네일 프롬프트</h3><textarea readOnly value={result.creative.thumbnailPrompt} rows={6} style={{ width: "100%" }} />
        <h3>블로그 이미지 3종</h3>{result.creative.blogImagePrompts.map((p, i) => <textarea key={i} readOnly value={p} rows={4} style={{ width: "100%", marginBottom: 8 }} />)}
        <h3>9:16 영상 통합 프롬프트</h3><textarea readOnly value={result.creative.verticalVideoPrompt} rows={8} style={{ width: "100%" }} />
        <button className="button button-light" onClick={() => copy(result.creative.verticalVideoPrompt, "영상 프롬프트")}>영상 프롬프트 복사</button>
      </Block>
      <Block title="💬 정확한 한국어 자막 패키지">
        <textarea readOnly value={result.subtitles.srt} rows={14} style={{ width: "100%" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="button button-light" onClick={() => copy(result.subtitles.srt, "SRT")}>SRT 복사</button><button className="button button-primary" onClick={downloadSrt}>SRT 다운로드</button></div>
      </Block>
      <Block title="🛡️ 품질·정책 검사">
        <h3>피해야 할 표현</h3><ul>{result.compliance.claimsToAvoid.map((v, i) => <li key={i}>{v}</li>)}</ul><h3>최종 체크리스트</h3><ul>{result.compliance.finalChecklist.map((v, i) => <li key={i}>✅ {v}</li>)}</ul>
      </Block>
    </>}
  </div>;
}
