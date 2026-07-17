import Link from "next/link";
export default function Page(){const items=[
 ["Galaxy Tab S10 FE 소재 제작","태블릿 카테고리의 최근 CTR과 검색 관심도가 함께 상승했습니다.",98,"19:00"],
 ["AI 브라우저 정보형 블로그","기존 AI 활용 독자와 주제 연관성이 높고 체류시간 기대치가 좋습니다.",92,"14:30"],
 ["USB-C 허브 비교 쇼츠","전환 데이터는 양호하지만 경쟁도가 높아 차별화된 사용 장면이 필요합니다.",85,"20:30"]
];return <div className="s6-simple-page"><span>AI ADVISOR</span><h1>오늘 무엇을 만들고 언제 게시할지 제안합니다.</h1><p>추천은 실제 성과 데이터와 Product Intelligence 점수를 함께 사용하며, 이유와 예상치를 투명하게 표시합니다.</p><div className="s6-advisor-list">{items.map(x=><article key={String(x[0])}><b>{x[2]}</b><div><h2>{x[0]}</h2><p>{x[1]}</p><small>추천 게시 시간 {x[3]}</small></div><Link href="/admin/content-factory">제작 시작 ↗</Link></article>)}</div></div>}
