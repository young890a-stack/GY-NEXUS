"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { ContentFactoryPackage } from "@/lib/content-factory/types";
import styles from "./ShortsProductionHub.module.css";

type ToolGroup = "AI 제작" | "키워드·SEO" | "썸네일" | "편집·음악" | "성과 분석";

type Tool = {
  id: string;
  name: string;
  group: ToolGroup;
  description: string;
  url: string;
  handoff: "copy" | "query" | "open";
  badge: string;
};

type FactoryResponse = {
  success?: boolean;
  result?: ContentFactoryPackage;
  message?: string;
};

const tools: Tool[] = [
  { id: "gemini", name: "Gemini", group: "AI 제작", description: "내 사진·영상의 핵심 장면과 훅을 분석합니다.", url: "https://gemini.google.com/", handoff: "copy", badge: "프롬프트 연동" },
  { id: "alphacut", name: "AlphaCut", group: "AI 제작", description: "롱폼 URL 또는 영상에서 하이라이트 쇼츠를 만듭니다.", url: "https://alphacut.video/", handoff: "copy", badge: "롱폼 전달" },
  { id: "runway", name: "Runway", group: "AI 제작", description: "상품 이미지와 프롬프트로 세로형 AI 영상 장면을 생성합니다.", url: "https://runwayml.com/", handoff: "copy", badge: "영상 프롬프트" },
  { id: "google-trends", name: "Google Trends", group: "키워드·SEO", description: "한국 검색 관심도와 계절성을 확인합니다.", url: "https://trends.google.com/trends/explore?geo=KR", handoff: "query", badge: "검색어 전달" },
  { id: "vidiq", name: "vidIQ", group: "키워드·SEO", description: "유튜브 키워드와 경쟁 영상을 검토합니다.", url: "https://app.vidiq.com/", handoff: "copy", badge: "키워드 전달" },
  { id: "tubebuddy", name: "TubeBuddy", group: "키워드·SEO", description: "제목·태그·경쟁도를 추가 점검합니다.", url: "https://www.tubebuddy.com/", handoff: "copy", badge: "제목 전달" },
  { id: "miricanvas", name: "미리캔버스", group: "썸네일", description: "한국형 폰트와 템플릿으로 쇼츠 커버·썸네일을 완성합니다.", url: "https://www.miricanvas.com/ko", handoff: "copy", badge: "디자인 패키지" },
  { id: "canva", name: "Canva", group: "썸네일", description: "글로벌 템플릿으로 썸네일과 릴스 커버를 제작합니다.", url: "https://www.canva.com/", handoff: "copy", badge: "디자인 패키지" },
  { id: "capcut", name: "CapCut", group: "편집·음악", description: "MP4·SRT·컷표를 받아 최종 효과와 색감을 마무리합니다.", url: "https://www.capcut.com/", handoff: "copy", badge: "편집 패키지" },
  { id: "movavi", name: "Movavi", group: "편집·음악", description: "PC에서 컷 편집·자막·음악·전환을 빠르게 마무리합니다.", url: "https://www.movavi.com/", handoff: "copy", badge: "PC 편집 패키지" },
  { id: "davinci", name: "DaVinci Resolve", group: "편집·음악", description: "전문 컬러·오디오·VFX 편집으로 확장합니다.", url: "https://www.blackmagicdesign.com/products/davinciresolve", handoff: "copy", badge: "전문 편집" },
  { id: "youtube-audio", name: "YouTube 오디오 라이브러리", group: "편집·음악", description: "저작권 안전한 배경음악과 효과음을 찾습니다.", url: "https://studio.youtube.com/", handoff: "copy", badge: "음악 검색" },
  { id: "epidemic", name: "Epidemic Sound", group: "편집·음악", description: "유료 고품질 음악과 효과음을 선택합니다.", url: "https://www.epidemicsound.com/", handoff: "copy", badge: "음악 검색" },
  { id: "youtube-studio", name: "YouTube Studio", group: "성과 분석", description: "CTR·시청 유지율·구독 전환을 확인합니다.", url: "https://studio.youtube.com/", handoff: "open", badge: "공식 분석" },
  { id: "socialblade", name: "Social Blade", group: "성과 분석", description: "채널과 경쟁 채널의 성장 추이를 비교합니다.", url: "https://socialblade.com/", handoff: "copy", badge: "경쟁 분석" },
];

const groups: ToolGroup[] = ["AI 제작", "키워드·SEO", "썸네일", "편집·음악", "성과 분석"];

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "GY-Shorts";
}

function downloadText(name: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ShortsProductionHub() {
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [longformUrl, setLongformUrl] = useState("");
  const [duration, setDuration] = useState<15 | 20 | 25 | 30>(20);
  const [tone, setTone] = useState("친근하고 재미있는 생활 밀착형");
  const [files, setFiles] = useState<File[]>([]);
  const [activeGroup, setActiveGroup] = useState<ToolGroup>("AI 제작");
  const [ownedTools, setOwnedTools] = useState<string[]>(["gemini", "alphacut", "runway", "capcut", "movavi", "miricanvas", "vidiq"]);
  const [result, setResult] = useState<ContentFactoryPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("상품명과 보유 소재를 준비한 뒤 한국형 쇼츠 패키지를 생성하세요.");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("gy-shorts-tool-subscriptions");
      if (saved) setOwnedTools(JSON.parse(saved) as string[]);
    } catch {
      // 저장값이 손상되면 기본값으로 계속합니다.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("gy-shorts-tool-subscriptions", JSON.stringify(ownedTools));
    } catch {
      // 사생활 보호 모드에서는 현재 화면에서만 유지합니다.
    }
  }, [ownedTools]);

  const keyword = useMemo(() => result?.seo.primaryKeyword || productName.trim(), [result, productName]);
  const filteredTools = useMemo(() => tools.filter((tool) => tool.group === activeGroup), [activeGroup]);

  async function copyText(text: string, label: string) {
    if (!text.trim()) {
      setError(`${label}에 사용할 내용이 없습니다.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setError("");
      setMessage(`${label} 복사 완료. 열린 도구에 붙여넣으세요.`);
    } catch {
      setError("클립보드 복사 권한이 차단되었습니다. HTTPS 운영 사이트에서 다시 시도해주세요.");
    }
  }

  function toggleOwned(id: string) {
    setOwnedTools((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function generatePackage() {
    if (!productName.trim()) {
      setError("상품명을 입력해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("한국형 훅·대본·장면표·자막·썸네일 패키지를 생성하고 있습니다.");
    try {
      const response = await fetch("/api/content-factory/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: productName.trim(),
          description: description.trim(),
          affiliateUrl: affiliateUrl.trim(),
          targetAudience: "20~40대 한국 시청자",
          shortsDuration: duration,
          tone,
          blogGoal: "sales",
          blogLength: "standard",
        }),
      });
      const data = await response.json() as FactoryResponse;
      if (!response.ok || !data.success || !data.result) throw new Error(data.message || "쇼츠 패키지 생성 실패");
      setResult(data.result);
      setMessage("한국형 쇼츠 패키지가 완성됐습니다. 아래 도구로 바로 넘길 수 있습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "쇼츠 패키지를 생성하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function geminiPrompt() {
    const fileNames = files.map((file) => file.name).join(", ") || "업로드할 상품 사진·영상";
    return `다음 상품 소재를 분석해 한국 YouTube Shorts용 편집안을 만들어줘.\n\n상품명: ${productName || "상품명"}\n상품 설명: ${description || "상품 설명 없음"}\n목표 길이: ${duration}초\n타깃: 20~40대 한국 시청자\n보유 소재: ${fileNames}\n\n분석 항목:\n1. 첫 2초 훅으로 가장 강한 장면\n2. 제거할 지루한 구간\n3. 문제-해결-사용장면-혜택-CTA 순서\n4. 장면별 권장 길이 0.8~2.2초\n5. 화면에 넣을 짧은 한국어 자막\n6. 과장광고와 저작권 위험 점검\n${result ? `\nDream Y 초안:\n제목: ${result.shorts.title}\n훅: ${result.shorts.hook}\n대본: ${result.shorts.voiceover}` : ""}`;
  }

  function thumbnailBrief() {
    const copies = result?.creative.thumbnailCopy.join(" / ") || `${productName || "상품"} 핵심 혜택 한 문장`;
    return `미리캔버스 쇼츠 디자인 패키지\n\n규격 1: 1080×1920 세로 쇼츠 커버\n규격 2: 1280×720 유튜브 썸네일\n타깃: 20~40대 한국 시청자\n상품명: ${productName || "상품명"}\n핵심 문구: ${copies}\n디자인 방향: 상품이 가장 크게 보이고, 한글은 2줄 이내, 배경과 글자의 명도 대비를 강하게, 과도한 가격·효능 과장 금지\n${result ? `AI 이미지 프롬프트: ${result.creative.thumbnailPrompt}\n세로 영상 프롬프트: ${result.creative.verticalVideoPrompt}` : ""}`;
  }

  function capcutGuide() {
    const scenes = result?.shorts.scenes.map((scene, index) => `${index + 1}. ${scene.start}~${scene.end}초 | 화면: ${scene.visual} | 자막: ${scene.subtitle}`).join("\n") || "먼저 쇼츠 패키지를 생성하세요.";
    return `CapCut 한국형 쇼츠 편집 가이드\n\n프로젝트: ${productName || "상품 쇼츠"}\n캔버스: 1080×1920, 9:16\n길이: ${duration}초\n컷 길이: 훅 0.8~1.5초, 본문 1.0~2.0초, CTA 1.5~2.0초\n자막: 하단 UI 영역을 피해 중앙 아래, 한 줄 12~16자, 정확한 한국어 SRT 사용\n전환: 과도한 효과보다 컷·줌·속도 변화 중심\n음악: 내레이션보다 -18~-24 LUFS 낮게\n\n장면표:\n${scenes}`;
  }

  function seoPayload() {
    return `상품명: ${productName}\n주요 키워드: ${keyword}\n보조 키워드: ${result?.seo.secondaryKeywords.join(", ") || "아직 생성되지 않음"}\n제목 후보: ${result?.shorts.title || "쇼츠 패키지를 먼저 생성하세요."}\n해시태그: ${result?.shorts.hashtags.join(" ") || ""}`;
  }

  function musicPayload() {
    return `영상: ${productName || "상품 쇼츠"}\n길이: ${duration}초\n분위기: 밝고 빠른 한국형 쇼핑 쇼츠, 첫 2초 임팩트, 생활 밀착형\n검색어: upbeat, bright, technology, summer, lifestyle, product demo\n주의: 상업적 사용 가능 여부와 채널 라이선스를 확인`;
  }

  function analyticsPayload() {
    return `분석할 쇼츠: ${result?.shorts.title || productName}\n확인 지표: 첫 3초 이탈률, 평균 시청 지속 시간, 평균 시청률, 반복 재생, CTR, 댓글·공유, 제휴링크 클릭\n판단 기준: 첫 3초 이탈이 높으면 훅 교체, 완주율이 낮으면 중간 설명 축소, CTR이 낮으면 제목·썸네일 교체`;
  }

  function payloadFor(tool: Tool) {
    if (tool.id === "gemini") return geminiPrompt();
    if (tool.id === "alphacut") return `AlphaCut 작업\n롱폼 URL: ${longformUrl || "유튜브 롱폼 URL을 입력하세요."}\n추출 기준: 제품 반응이 강한 장면, 결과가 먼저 보이는 장면, 15~30초 완결 구조\n후처리: Dream Y 한국형 대본과 정확한 SRT로 교체`;
    if (tool.id === "runway") return result?.creative.verticalVideoPrompt || geminiPrompt();
    if (tool.id === "miricanvas" || tool.id === "canva") return thumbnailBrief();
    if (tool.id === "capcut" || tool.id === "movavi" || tool.id === "davinci") return capcutGuide();
    if (tool.id === "youtube-audio" || tool.id === "epidemic") return musicPayload();
    if (tool.id === "youtube-studio" || tool.id === "socialblade") return analyticsPayload();
    return seoPayload();
  }

  async function openTool(tool: Tool) {
    setError("");
    if (tool.handoff !== "open") await copyText(payloadFor(tool), `${tool.name} 작업 패키지`);
    let url = tool.url;
    if (tool.id === "google-trends" && keyword) {
      url = `https://trends.google.com/trends/explore?geo=KR&q=${encodeURIComponent(keyword)}`;
    }
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) setError("브라우저에서 팝업이 차단됐습니다. 이 사이트의 팝업을 허용해주세요.");
  }

  function downloadBundle() {
    if (!result) {
      setError("먼저 한국형 쇼츠 패키지를 생성해주세요.");
      return;
    }
    const text = `# ${result.shorts.title}\n\n## 훅\n${result.shorts.hook}\n\n## 대본\n${result.shorts.voiceover}\n\n## 장면표\n${result.shorts.scenes.map((scene, index) => `${index + 1}. ${scene.start}~${scene.end}초 | ${scene.visual} | ${scene.subtitle}`).join("\n")}\n\n## CapCut\n${capcutGuide()}\n\n## 미리캔버스\n${thumbnailBrief()}\n\n## SEO\n${seoPayload()}\n\n## 게시 설명\n${result.shorts.description}\n\n## 고정댓글\n${result.shorts.pinnedComment}`;
    downloadText(`${safeName(result.shorts.title)}-쇼츠제작패키지.md`, text, "text/markdown");
    setMessage("전체 쇼츠 제작 패키지를 다운로드했습니다.");
  }

  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span>GY-NEXUS · ALL-IN-ONE SHORTS PRODUCTION</span>
          <h1>통합 쇼츠 제작실</h1>
          <p>한국형 쇼츠와 중국 쇼핑 숏폼을 분리해 제작하면서, 대표님이 결제한 AI·SEO·썸네일·편집·분석 도구를 한 화면에서 이어 사용합니다.</p>
        </div>
        <div className={styles.heroActions}>
          <Link href="/admin/revenue-shorts">중국 쇼핑 숏폼 열기</Link>
          <Link href="/admin/creative-studio-pro">사이트 MP4 제작 열기</Link>
        </div>
      </header>

      {(message || error) && <div className={error ? styles.error : styles.notice}><b>{error ? "확인 필요" : "진행 상태"}</b><span>{error || message}</span></div>}

      <section className={styles.workspace}>
        <div className={styles.panel}>
          <div className={styles.panelHead}><span>01</span><div><small>KOREAN SHORTS</small><h2>한국형 쇼츠 기획</h2></div></div>
          <div className={styles.formGrid}>
            <label>상품명<input value={productName} onChange={(event: ChangeEvent<HTMLInputElement>) => setProductName(event.target.value)} placeholder="예: 휴대용 손선풍기" /></label>
            <label>제휴링크<input value={affiliateUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => setAffiliateUrl(event.target.value)} placeholder="https://" /></label>
            <label className={styles.wide}>상품 설명<textarea value={description} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDescription(event.target.value)} rows={4} placeholder="제품 특징, 사용 장면, 타깃의 고민을 적으세요." /></label>
            <label>길이<select value={duration} onChange={(event: ChangeEvent<HTMLSelectElement>) => setDuration(Number(event.target.value) as 15 | 20 | 25 | 30)}>{[15,20,25,30].map((value) => <option key={value} value={value}>{value}초</option>)}</select></label>
            <label>톤<select value={tone} onChange={(event: ChangeEvent<HTMLSelectElement>) => setTone(event.target.value)}><option>친근하고 재미있는 생활 밀착형</option><option>빠르고 강한 쇼핑 전환형</option><option>신뢰감 있고 자연스러운 전문가형</option><option>감성적인 프리미엄 스토리형</option></select></label>
            <label className={styles.wide}>내 사진·영상<input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" onChange={(event: ChangeEvent<HTMLInputElement>) => setFiles(Array.from(event.target.files || []))} /></label>
            {files.length > 0 && <div className={styles.fileList}>{files.map((file) => <span key={`${file.name}-${file.size}`}>{file.name}</span>)}</div>}
            <label className={styles.wide}>AlphaCut용 롱폼 URL<input value={longformUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => setLongformUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label>
          </div>
          <button type="button" className={styles.primaryButton} onClick={() => void generatePackage()} disabled={busy}>{busy ? "Dream Y가 제작 중..." : "한국형 쇼츠 패키지 생성"}</button>
        </div>

        <aside className={styles.routePanel}>
          <div><span>한국형</span><h3>내 사진·영상 중심</h3><p>Dream Y 대본 → Gemini 분석 → 미리캔버스 → CapCut → YouTube</p></div>
          <div><span>중국형</span><h3>도우인·샤오홍슈 연구</h3><p>중국 인기 구조 → 한국어 재구성 → 권리 확인 → MP4 제작</p><Link href="/admin/revenue-shorts">중국 전용 제작실 이동</Link></div>
          <div><span>자동 MP4</span><h3>OpenAI·Runway 활용</h3><p>상품 이미지 기반 새 장면을 만들고 최종 세로 MP4로 합성합니다.</p><Link href="/admin/creative-studio-pro">Creative Studio Pro 이동</Link></div>
        </aside>
      </section>

      {result && <section className={styles.resultPanel}>
        <div className={styles.resultHead}><div><small>READY TO PRODUCE</small><h2>{result.shorts.title}</h2></div><div><button onClick={() => downloadText(`${safeName(result.shorts.title)}.srt`, result.subtitles.srt)}>SRT 다운로드</button><button onClick={downloadBundle}>전체 패키지 다운로드</button></div></div>
        <div className={styles.resultGrid}>
          <article><span>첫 2초 훅</span><strong>{result.shorts.hook}</strong></article>
          <article><span>전체 대본</span><p>{result.shorts.voiceover}</p><button onClick={() => void copyText(result.shorts.voiceover, "쇼츠 대본")}>대본 복사</button></article>
          <article className={styles.wideCard}><span>장면 구성</span>{result.shorts.scenes.map((scene, index) => <div className={styles.scene} key={`${scene.start}-${index}`}><b>{scene.start}~{scene.end}초</b><p>{scene.visual}</p><em>{scene.subtitle}</em></div>)}</article>
          <article><span>미리캔버스 문구</span><p>{result.creative.thumbnailCopy.join(" / ")}</p><button onClick={() => void copyText(thumbnailBrief(), "미리캔버스 디자인 패키지")}>디자인 패키지 복사</button></article>
          <article><span>SEO 키워드</span><p>{result.seo.primaryKeyword}<br />{result.seo.secondaryKeywords.join(", ")}</p><button onClick={() => void copyText(seoPayload(), "SEO 패키지")}>SEO 복사</button></article>
        </div>
      </section>}

      <section className={styles.toolsPanel}>
        <div className={styles.toolsHead}><div><small>CONNECTED WORKFLOW</small><h2>쇼츠 제작 도구함</h2><p>‘사용 중’ 표시는 대표님 기기에 저장됩니다. 로그인 비밀번호는 GY-NEXUS에 저장하지 않습니다.</p></div></div>
        <div className={styles.tabs}>{groups.map((group) => <button key={group} className={activeGroup === group ? styles.activeTab : ""} onClick={() => setActiveGroup(group)}>{group}</button>)}</div>
        <div className={styles.toolGrid}>{filteredTools.map((tool) => {
          const owned = ownedTools.includes(tool.id);
          return <article className={owned ? styles.ownedTool : styles.toolCard} key={tool.id}>
            <div className={styles.toolTop}><span>{tool.badge}</span><button onClick={() => toggleOwned(tool.id)}>{owned ? "✓ 사용 중" : "+ 사용 등록"}</button></div>
            <h3>{tool.name}</h3><p>{tool.description}</p>
            <button className={styles.openButton} onClick={() => void openTool(tool)}>{tool.name}에 넘기기</button>
          </article>;
        })}</div>
      </section>
    </main>
  );
}
