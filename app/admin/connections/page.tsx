import ConnectionsManager from "@/components/admin/ConnectionsManager";

export const dynamic = "force-dynamic";

export default function ConnectionsPage() {
  return (
    <div className="admin-page connections-page">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">UNIFIED CONNECTION CENTER</span>
          <h1>통합 연결센터</h1>
          <p>
            환경변수 준비 상태부터 OAuth 콜백, 실제 계정 권한까지 한 화면에서 진단합니다.
            각 외부 서비스에는 아래에 표시되는 콜백 주소를 그대로 한 번만 등록하세요.
          </p>
        </div>
      </header>
      <ConnectionsManager />
      <section className="connections-guide">
        <h2>404 없이 연결하는 순서</h2>
        <div className="guide-grid">
          <div><strong>1. 주소 복사</strong><p>각 카드의 ‘외부 콘솔 콜백 주소’를 복사합니다. localhost 주소는 운영 서비스에 등록하지 않습니다.</p></div>
          <div><strong>2. 외부 콘솔 등록</strong><p>Google Cloud 또는 Naver Developers의 Callback/Redirect URI 칸에 복사한 주소를 글자 하나까지 똑같이 저장합니다.</p></div>
          <div><strong>3. 계정 연결</strong><p>반드시 이 연결센터의 ‘계정 연결’ 버튼으로 시작하고 권한을 승인합니다.</p></div>
          <div><strong>4. 즉시 진단</strong><p>돌아온 뒤 ‘연동 자동 진단’과 카드의 연결 완료 표시를 확인합니다. 실패하면 원인이 한국어로 구분되어 표시됩니다.</p></div>
        </div>
      </section>
    </div>
  );
}
