import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { MEMBER_PLANS } from "@/lib/subscriptions/plans";

export const metadata = {
  title: "GY 요금제 | 나에게 필요한 만큼 시작하세요",
  description: "무료로 시작하고 필요할 때 GY Plus와 Pro로 확장하는 멤버십 설계입니다.",
};

export default function PricingPage() {
  const plans = Object.values(MEMBER_PLANS);
  return (
    <div className="shell pricing-shell">
      <SiteHeader />
      <main className="container pricing-page">
        <section className="pricing-hero">
          <span className="eyebrow">GY MEMBERSHIP</span>
          <h1>필요한 만큼 시작하고,<br />성과가 생기면 확장하세요.</h1>
          <p>현재는 Free 베타를 운영합니다. Plus와 Pro는 결제·환불·사용량 보호를 검증한 뒤 공개합니다.</p>
          <div className="pricing-trust"><span>✓ 수익 보장 표현 없음</span><span>✓ 월 사용량 사전 공개</span><span>✓ 유료 전환 전 명확한 동의</span></div>
        </section>

        <section className="pricing-grid" aria-label="GY 요금제">
          {plans.map((plan) => (
            <article className={`pricing-card ${plan.recommended ? "recommended" : ""}`} key={plan.key}>
              {plan.recommended && <span className="pricing-badge">가장 균형 잡힌 선택</span>}
              <h2>{plan.name}</h2>
              <p>{plan.description}</p>
              <div className="pricing-price"><strong>{plan.monthlyPrice.toLocaleString("ko-KR")}원</strong><span>/ 월</span></div>
              <div className="pricing-quota">AI 제작 월 {plan.monthlyAiRequests}회</div>
              <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
              {plan.key === "free" ? (
                <Link href="/signup" className="button button-primary">무료로 시작하기</Link>
              ) : (
                <Link href="/member/inquiries" className="button button-light">출시 알림 문의</Link>
              )}
              {plan.key !== "free" && <small>베타 준비 중 · 아직 결제되지 않습니다.</small>}
            </article>
          ))}
        </section>

        <section className="panel pricing-principles">
          <div><span>01</span><b>무료에서 가치 확인</b><p>가입 직후 추천과 AI 제목 도구를 체험합니다.</p></div>
          <div><span>02</span><b>필요할 때만 확장</b><p>사용량과 기능 차이를 보고 선택합니다.</p></div>
          <div><span>03</span><b>대표 승인 후 출시</b><p>실제 결제는 약관·환불·보안을 갖춘 뒤 엽니다.</p></div>
        </section>
      </main>
    </div>
  );
}
