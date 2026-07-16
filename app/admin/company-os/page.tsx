import CompanyOSCommandCenter from "@/components/company-os/CompanyOSCommandCenter";

export const dynamic = "force-dynamic";

export default function CompanyOSPage() {
  return (
    <>
      <section className="dashboard-hero company-os-hero">
        <div>
          <span className="dashboard-kicker">GY FIRST RELEASE PRODUCTION 1.0</span>
          <h1>GY Company OS</h1>
          <p>상품, 콘텐츠, 품질, 게시, 고객과 성장 데이터를 하나의 운영 흐름으로 연결합니다.</p>
        </div>
      </section>
      <CompanyOSCommandCenter />
    </>
  );
}
