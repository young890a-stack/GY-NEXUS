"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./ShortsTrackHub.module.css";

type ProductionMode = "auto" | "guided" | "manual";

const modes = [
  {
    id: "auto" as const,
    eyebrow: "AUTOPILOT",
    title: "AI 완전 자동",
    description: "상품만 승인하면 기획, 장면, 음성, 자막, 품질검수와 최종 MP4까지 Dream Y가 이어서 제작합니다.",
    badge: "속도 우선",
    steps: ["상품 1회 승인", "85점 미만 장면 자동 재생성", "완성본은 비공개 대기열"],
  },
  {
    id: "guided" as const,
    eyebrow: "DIRECTOR MODE",
    title: "대표 반자동",
    description: "AI가 초안을 만들고 대표님이 전략, 장면, 최종본의 세 지점에서 결정합니다. 가장 추천하는 기본 모드입니다.",
    badge: "추천",
    steps: ["전략 승인", "장면·대본 승인", "최종 공개 승인"],
  },
  {
    id: "manual" as const,
    eyebrow: "PRO STUDIO",
    title: "정밀 수동",
    description: "컷, 음성, 음악, 자막, 썸네일과 게시 문구까지 직접 조정하는 전문가용 제작 모드입니다.",
    badge: "정밀 제어",
    steps: ["모든 단계 직접 조정", "소유 영상 Gemini 분석", "CapCut 패키지 제공"],
  },
];

const productionFlow = [
  ["01", "상품 진단", "상품 정보·가격·제휴 링크와 시각적 판매 가능성을 확인합니다."],
  ["02", "판매 전략", "첫 2초 훅, 문제–해결 구조, CTA와 플랫폼별 문구를 설계합니다."],
  ["03", "장면 제작", "상품 정체성을 유지한 9:16 장면을 만들고 기준 미달 장면을 재생성합니다."],
  ["04", "음성·자막", "한국어 음성과 장면별 정확한 자막 타이밍을 맞춥니다."],
  ["05", "최종 검수", "과장, 권리, 상품 불일치, 자막 오류와 영상 품질을 다시 검사합니다."],
  ["06", "비공개 배포", "완성 MP4를 YouTube 비공개 대기열에 넣고 대표 공개 승인을 기다립니다."],
];

export default function ShortsTrackHub() {
  const [mode, setMode] = useState<ProductionMode>("guided");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const selected = modes.find((item) => item.id === mode) ?? modes[1];
  const startHref = useMemo(() => {
    const params = new URLSearchParams({ mode });
    if (affiliateUrl.trim()) params.set("url", affiliateUrl.trim());
    return `/admin/korean-shorts?${params.toString()}`;
  }, [affiliateUrl, mode]);

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>DREAM Y SHOPPING SHORTS OS</span>
          <h1>잘 팔리는 쇼츠를<br /><b>안전하게 반복 생산합니다.</b></h1>
          <p>상품 발굴부터 한국형 판매 전략, AI 장면, 음성·자막, 최종 MP4와 YouTube 비공개 배포까지 하나의 운영 흐름으로 연결했습니다.</p>
          <div className={styles.heroPills}><span>9:16 세로 영상</span><span>85점 품질 기준</span><span>공개 전 대표 승인</span></div>
        </div>
        <div className={styles.commandCard}>
          <span>오늘의 운영 원칙</span>
          <strong>자동화는 빠르게,<br />공개 결정은 신중하게.</strong>
          <div><b>자동</b><small>반복 작업·검수·재시도</small><b>대표</b><small>상품·비용·최종 공개 승인</small></div>
        </div>
      </section>

      <section className={styles.launchPanel}>
        <div className={styles.sectionHead}>
          <div><span>01 · OPERATING MODE</span><h2>오늘은 어디까지 자동으로 맡길까요?</h2></div>
          <p>언제든 제작실 안에서 모드를 바꿀 수 있습니다.</p>
        </div>
        <div className={styles.modeGrid}>
          {modes.map((item) => {
            const active = item.id === mode;
            return (
              <button key={item.id} type="button" className={active ? styles.modeActive : styles.modeCard} onClick={() => setMode(item.id)} aria-pressed={active}>
                <div><span>{item.eyebrow}</span><em>{item.badge}</em></div>
                <h3>{item.title}</h3><p>{item.description}</p>
                <ul>{item.steps.map((step) => <li key={step}>{step}</li>)}</ul>
              </button>
            );
          })}
        </div>
        <div className={styles.quickStart}>
          <div><span>02 · QUICK START</span><h2>상품 링크 하나로 시작</h2><p>쿠팡·Temu·네이버·알리 등 상품 주소를 넣으면 가능한 정보를 먼저 읽습니다.</p></div>
          <div className={styles.urlBox}>
            <label htmlFor="shorts-product-url">상품 또는 제휴 링크</label>
            <div>
              <input id="shorts-product-url" type="url" inputMode="url" value={affiliateUrl} onChange={(event) => setAffiliateUrl(event.target.value)} placeholder="https:// 상품 링크를 붙여넣으세요" />
              <Link href={startHref}>{selected.title} 시작</Link>
            </div>
            <small>상품 사진과 상세정보가 자동으로 부족하면 제작실에서 직접 보완할 수 있습니다.</small>
          </div>
        </div>
      </section>

      <section className={styles.guardrails}>
        <div className={styles.sectionHead}><div><span>SAFETY & QUALITY</span><h2>최고 품질을 위한 자동 안전장치</h2></div><p>자동화가 대표님의 판단을 건너뛰지 않도록 설계했습니다.</p></div>
        <div className={styles.guardGrid}>
          <article><b>85점 품질 게이트</b><p>상품 일치·시각 품질 기준을 통과하지 못한 장면은 자동 재시도합니다.</p></article>
          <article><b>권리 미확인 원본 차단</b><p>중국 인기 영상은 판매 구조만 분석하고 원본 영상은 최종본에 사용하지 않습니다.</p></article>
          <article><b>비용 승인 분리</b><p>유료 영상 생성 단계는 대표가 선택하며 실패한 단계부터 다시 이어갑니다.</p></article>
          <article><b>과장·허위 문구 차단</b><p>상품 설명에 없는 기능, 허위 긴급성, 수익 보장 표현을 금지합니다.</p></article>
          <article><b>정확한 한국어 자막</b><p>장면별 음성과 자막 시간을 맞추고 자동 자막 오류를 최종 검수합니다.</p></article>
          <article><b>공개 전 최종 승인</b><p>YouTube에는 먼저 비공개로 등록하고 대표 확인 후 공개합니다.</p></article>
        </div>
      </section>

      <section className={styles.flowPanel}>
        <div className={styles.sectionHead}><div><span>PRODUCTION LINE</span><h2>상품에서 수익 학습까지</h2></div><Link href="/admin/product-intelligence">상품 후보부터 찾기</Link></div>
        <div className={styles.flowGrid}>
          {productionFlow.map(([number, title, description]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}
        </div>
        <footer><Link href={startHref}>선택한 모드로 제작실 열기</Link><Link href="/admin/china-video-lab">중국 트렌드 구조 분석</Link><Link href="/admin/publishing">비공개 게시 대기열</Link></footer>
      </section>
    </main>
  );
}
