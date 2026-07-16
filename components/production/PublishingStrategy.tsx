"use client";
import { useState } from "react";
const modes = [
  ["google_approval","Google AdSense 승인","정보성·독창성·중립성 중심, 과도한 제휴 CTA 제외"],
  ["naver_approval","Naver AdPost 승인","생활 공감·체류·가독성 중심, 플랫폼 문체 적용"],
  ["seo_growth","SEO 성장","Search Console 데이터 기반 제목·구조·CTR 최적화"],
  ["affiliate","제휴 마케팅","구매 의도를 충족하되 사실 확인과 광고 고지 적용"],
] as const;
export default function PublishingStrategy(){const [selected,setSelected]=useState<string[]>(["google_approval","naver_approval"]);return <div className="strategy-grid">{modes.map(([id,title,description])=><button type="button" key={id} onClick={()=>setSelected((current)=>current.includes(id)?current.filter((x)=>x!==id):[...current,id])} className={`strategy-card panel ${selected.includes(id)?"selected":""}`}><span>{selected.includes(id)?"✓":"+"}</span><h2>{title}</h2><p>{description}</p></button>)}<section className="panel strategy-summary"><span className="eyebrow">현재 운영 전략</span><h2>{selected.length}개 모드 동시 생성</h2><p>같은 주제라도 플랫폼별 원고를 별도로 생성해 중복 게시 위험을 줄입니다.</p><div className="strategy-tags">{selected.map((id)=><span key={id}>{modes.find((m)=>m[0]===id)?.[1]}</span>)}</div></section></div>}
