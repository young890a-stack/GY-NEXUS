import CompanyOSCommandCenter from "@/components/company-os/CompanyOSCommandCenter";

export const dynamic = "force-dynamic";

export default function CompanyOSPage() {
  return (
    <>
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">SPRINT 10 · ONE HUMAN. ONE AI COMPANY.</span>
          <h1>GY-NEXUS AI Company OS</h1>
          <p>대표 상황실에서 연결 상태, 콘텐츠 생산, 자동화 작업, 게시 흐름과 성장 데이터를 한 번에 점검합니다.</p>
        </div>
      </section>
      <CompanyOSCommandCenter />
    </>
  );
}
