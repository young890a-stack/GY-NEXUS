import StaffAccessManager from "@/components/admin/StaffAccessManager";

export const dynamic = "force-dynamic";

export default function StaffPage() {
  return (
    <section className="section">
      <div className="admin-top"><div><span className="eyebrow">ACCESS CONTROL</span><h1>회원·직원 권한 관리</h1><p>일반 회원과 회사 직원을 분리하고 직원의 업무 범위를 단계별로 지정합니다.</p></div></div>
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <article className="panel"><h2>대표</h2><p>전체 설정과 직원 권한을 관리합니다.</p></article>
        <article className="panel"><h2>관리자</h2><p>운영과 제작 업무를 총괄합니다.</p></article>
        <article className="panel"><h2>제작 담당</h2><p>상품·콘텐츠·쇼츠 제작을 담당합니다.</p></article>
        <article className="panel"><h2>조회 전용</h2><p>대시보드와 실적을 읽기만 합니다.</p></article>
      </div>
      <StaffAccessManager />
      <div className="alert alert-warning" style={{ marginTop: 20 }}>
        현재 배포 단계에서는 대표 계정만 관리자 운영실에 입장합니다. 직원별 메뉴 허용은 다음 보안 점검 후 단계적으로 활성화합니다.
      </div>
    </section>
  );
}

