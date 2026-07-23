import Link from "next/link";
const rules=[
 ["제목 학습","숫자·문제해결형 제목에서 CTR 상승","+12.8%"],
 ["게시시간 학습","평일 19:00~21:00 성과 우수","+18.4%"],
 ["영상길이 학습","22~27초 쇼츠 완주율 우수","+9.6%"],
 ["CTA 학습","혜택보다 사용 장면 CTA 전환 우수","+7.2%"],
];
export default function Page(){return <div className="s6-simple-page"><span>LEARNING ENGINE</span><h1>성과를 다음 제작 기준으로 바꾸는 학습 엔진</h1><p>실제 데이터가 쌓이면 제목, 썸네일, 영상 길이, 게시 시간과 CTA별 성과를 비교해 추천 점수를 보정합니다.</p><div className="s6-rule-grid">{rules.map(r=><article key={r[0]}><small>ACTIVE RULE</small><h2>{r[0]}</h2><p>{r[1]}</p><strong>{r[2]}</strong></article>)}</div><div className="s6-learning-note"><h2>안전한 학습 원칙</h2><p>수익을 보장하지 않고 표본 수·최근성·채널 차이를 반영합니다. 데이터가 부족하면 추천 신뢰도를 낮추며 자동 게시 전에는 대표 승인 규칙을 유지합니다.</p><Link href="/admin/revenue-dashboard">Revenue Dashboard로 돌아가기 →</Link></div></div>}
