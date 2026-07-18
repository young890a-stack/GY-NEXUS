export type DreamAgent = {
  id: string;
  name: string;
  role: string;
  icon: string;
  mission: string;
};

export const DREAM_AGENTS: DreamAgent[] = [
  { id: "ethan", name: "Ethan", role: "시장전략", icon: "📈", mission: "시장 흐름, 시즌성, 경쟁 강도를 분석합니다." },
  { id: "noah", name: "Noah", role: "상품분석", icon: "🛒", mission: "쿠팡·Temu 상품 후보와 수익 기회를 평가합니다." },
  { id: "aurora", name: "Aurora", role: "SEO 편집", icon: "📝", mission: "Blogger와 네이버용 검색 콘텐츠 전략을 설계합니다." },
  { id: "luna", name: "Luna", role: "쇼츠 감독", icon: "🎬", mission: "15~30초 훅, 장면, 대본, CTA를 설계합니다." },
  { id: "mia", name: "Mia", role: "크리에이티브", icon: "🎨", mission: "썸네일과 이미지 콘셉트의 일관성을 관리합니다." },
  { id: "atlas", name: "Atlas", role: "데이터 분석", icon: "📊", mission: "조회수, 클릭률, 수익 데이터를 해석합니다." },
  { id: "gemini", name: "Gemini", role: "독립 교차검증", icon: "✦", mission: "Dream Y의 전략을 다른 모델 관점에서 검증하고 위험과 수정사항을 찾습니다." },
  { id: "sophia", name: "Sophia", role: "품질·정책", icon: "🛡️", mission: "과장 표현, 광고 고지, 품질 기준을 검수합니다." },
  { id: "orion", name: "Orion", role: "자동화", icon: "⚙️", mission: "예약, 게시, 재시도, 작업 상태를 관리합니다." },
];
