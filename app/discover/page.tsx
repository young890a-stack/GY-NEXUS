import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const categories = ["AI 활용", "재테크", "부업", "IT 리뷰", "생활 정보", "추천 상품"];
export default function DiscoverPage() {
  return <div className="shell"><SiteHeader /><main className="container section"><section className="discover-hero"><span className="eyebrow">GY DISCOVER</span><h1>신뢰할 수 있는 정보와<br/>실용적인 AI 콘텐츠</h1><p>승인용 정보 콘텐츠와 SEO 성장 콘텐츠를 분리해 운영하고, 검수된 결과만 공개합니다.</p></section><div className="interest-chips">{categories.map((item)=><span key={item}>{item}</span>)}</div><section className="grid grid-3 discover-cards"><article className="panel"><b>Google 승인 콘텐츠</b><h2>정보성과 신뢰 중심</h2><p>과도한 광고 없이 독창적이고 충분한 설명을 제공하는 글입니다.</p></article><article className="panel"><b>Naver 승인 콘텐츠</b><h2>생활 공감과 체류 중심</h2><p>플랫폼에 맞는 자연스러운 문체와 읽기 쉬운 구성을 적용합니다.</p></article><article className="panel"><b>SEO 성장 콘텐츠</b><h2>검색 데이터 기반</h2><p>Search Console과 GA4 데이터를 바탕으로 개선 대상을 찾습니다.</p></article></section><div className="actions"><Link href="/signup" className="button button-primary">GY 회원으로 시작</Link><Link href="/products" className="button button-light">상품 둘러보기</Link></div></main></div>;
}
