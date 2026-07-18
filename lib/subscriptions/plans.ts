export type MemberPlanKey = "free" | "plus" | "pro";

export type MemberPlan = {
  key: MemberPlanKey;
  name: string;
  monthlyPrice: number;
  monthlyAiRequests: number;
  description: string;
  recommended?: boolean;
  features: string[];
};

export const MEMBER_PLANS: Record<MemberPlanKey, MemberPlan> = {
  free: {
    key: "free",
    name: "GY Free",
    monthlyPrice: 0,
    monthlyAiRequests: 3,
    description: "GY의 추천과 가벼운 AI 체험을 시작하는 회원 요금제",
    features: ["맞춤 콘텐츠·상품 탐색", "북마크와 알림", "AI 제목 아이디어 월 3회"],
  },
  plus: {
    key: "plus",
    name: "GY Plus",
    monthlyPrice: 9900,
    monthlyAiRequests: 60,
    description: "꾸준히 콘텐츠를 만들고 싶은 개인·초기 크리에이터용",
    recommended: true,
    features: ["Free의 모든 기능", "AI 제목·개요·쇼츠 기획 월 60회", "관심 키워드 알림", "결과 저장"],
  },
  pro: {
    key: "pro",
    name: "GY Pro",
    monthlyPrice: 29000,
    monthlyAiRequests: 300,
    description: "콘텐츠 패키지와 분석을 반복 생산하는 운영자용",
    features: ["Plus의 모든 기능", "AI 제작 월 300회", "SEO·콘텐츠 패키지", "내보내기", "우선 지원"],
  },
};

export const MEMBER_AI_FEATURE = "member_ai_generation";

export function getMemberPlan(value: string | null | undefined) {
  if (value === "plus" || value === "pro") return MEMBER_PLANS[value];
  return MEMBER_PLANS.free;
}
