import SetupWizard from "@/components/setup/SetupWizard";
export default function SetupPage() { return <div className="admin-page"><header className="admin-page-header"><div><span className="eyebrow">CONNECT-ONLY SETUP</span><h1>초기 설치 마법사</h1><p>코드를 수정하지 않고 환경변수 입력과 계정 승인만으로 운영 준비 상태를 확인합니다.</p></div></header><SetupWizard /></div>; }
