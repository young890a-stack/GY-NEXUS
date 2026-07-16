import AiOperationsAssistant from "@/components/assistant/AiOperationsAssistant";
export default function AssistantPage() {
  return <div className="admin-page"><header className="admin-page-header"><div><span className="eyebrow">AI OPERATIONS ASSISTANT</span><h1>AI 운영 비서</h1><p>Owner의 자연어 명령을 상품 분석·콘텐츠 제작·미디어 제작·게시 예약 단계로 나눕니다. 외부 게시 작업은 승인 후 실행합니다.</p></div></header><AiOperationsAssistant /></div>;
}
