import Link from "next/link";

const modules = [
  ["GY Product DNA", "상품 링크와 핵심 정보를 판매 가능한 캠페인 구조로 전환합니다.", "/admin/product-dna"],
  ["GY Blog Factory", "AdSense·AdPost 승인형과 SEO 성장형 글을 목적에 맞게 생성합니다.", "/admin/content-factory"],
  ["GY Shorts Factory", "20·25·30초 쇼츠의 훅, 장면, 자막, CTA를 설계합니다.", "/admin/content"],
  ["GY Creative", "이미지, 썸네일, 숏폼 비주얼을 브랜드 기준으로 제작합니다.", "/admin/creative-studio-pro"],
  ["GY Video Studio", "장면 생성부터 렌더링까지 멀티샷 영상 흐름을 운영합니다.", "/admin/creative-studio-pro"],
  ["GY Quality", "SEO, 가독성, 브랜드, 과장 표현과 게시 가능 여부를 검수합니다.", "/admin/quality-center"],
];

export default function AiFactoryPage() {
  return (
    <div>
      <div className="admin-top">
        <div>
          <span className="eyebrow">GY AI FACTORY</span>
          <h1>하나의 흐름으로 완성하는 GY 제작 시스템</h1>
          <p>상품 분석부터 콘텐츠 제작, 품질 검수, 게시 준비까지 연결합니다.</p>
        </div>
      </div>
      <section className="grid grid-3">
        {modules.map(([title, text, href]) => (
          <article className="panel" key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
            <Link className="button button-primary" href={href}>열기</Link>
          </article>
        ))}
      </section>
    </div>
  );
}
