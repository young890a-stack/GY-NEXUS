import ShortsProductionHub from "@/components/shorts-hub/ShortsProductionHub";

export const metadata = {
  title: "쇼핑 쇼츠 AI 제작 캔버스 Phase 3 · GY-NEXUS",
  description: "Gemini가 내 영상을 분석해 좋은 구간을 자동 선별하고 문장별 음성·음악·효과음·최종 MP4까지 연결합니다.",
};

export default function ShortsHubPage() {
  return <ShortsProductionHub />;
}
