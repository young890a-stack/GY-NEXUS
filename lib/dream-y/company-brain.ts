import OpenAI from "openai";
import { DREAM_AGENTS } from "./agents";

export type StrategyResult = {
  executiveSummary: string;
  objective: string;
  decision: string;
  confidence: number;
  agentOpinions: { agentId: string; opinion: string; score: number }[];
  missions: { title: string; owner: string; priority: "high" | "medium" | "low"; action: string; approvalRequired: boolean }[];
  risks: string[];
  successMetrics: string[];
};

const fallback = (command: string): StrategyResult => ({
  executiveSummary: `대표 명령 “${command}”을 기준으로 상품 분석 → 콘텐츠 제작 → 품질 검수 → 게시 승인 순서의 실행안을 준비했습니다.`,
  objective: "대표의 작업 시간을 줄이면서 수익 가능성이 높은 콘텐츠 캠페인을 실행합니다.",
  decision: "인기상품 후보 3개를 먼저 점수화한 뒤 최고점 상품으로 쇼츠 1개와 블로그 1개를 제작합니다.",
  confidence: 72,
  agentOpinions: DREAM_AGENTS.slice(0, 6).map((agent, index) => ({ agentId: agent.id, opinion: `${agent.role} 관점에서 데이터 확인 후 단계적으로 실행하는 것이 안전합니다.`, score: 78 - index * 3 })),
  missions: [
    { title: "상품 후보 분석", owner: "noah", priority: "high", action: "/admin/trends", approvalRequired: false },
    { title: "콘텐츠 패키지 제작", owner: "aurora", priority: "high", action: "/admin/content", approvalRequired: false },
    { title: "쇼츠 제작 준비", owner: "luna", priority: "medium", action: "/admin/content", approvalRequired: false },
    { title: "게시 승인", owner: "orion", priority: "medium", action: "/admin/publishing", approvalRequired: true },
  ],
  risks: ["외부 플랫폼 정책과 API 권한을 확인해야 합니다.", "예상 수익은 보장값이 아니며 실제 성과 데이터로 보정해야 합니다."],
  successMetrics: ["콘텐츠 완성률", "게시 성공률", "클릭률", "상품별 실제 수익"],
});

export async function runCompanyBrain(command: string, memories: string[]): Promise<StrategyResult> {
  if (!process.env.OPENAI_API_KEY) return fallback(command);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `당신은 GY-NEXUS AI Company OS의 총괄 설계자 Dream Y다.\n대표 명령: ${command}\n회사 기억: ${memories.join(" | ") || "없음"}\nAI 직원: ${DREAM_AGENTS.map(a => `${a.id}:${a.role}`).join(", ")}\n반드시 실행 가능한 JSON만 반환한다. 형식: {"executiveSummary":"", "objective":"", "decision":"", "confidence":0, "agentOpinions":[{"agentId":"ethan","opinion":"","score":0}], "missions":[{"title":"","owner":"noah","priority":"high","action":"/admin/trends","approvalRequired":false}], "risks":[""], "successMetrics":[""]}. 과장된 수익 보장 금지. 공식 API와 정책 범위를 존중한다.`;
  try {
    const response = await openai.responses.create({ model: process.env.OPENAI_MODEL || "gpt-5.5", input: prompt });
    const raw = response.output_text?.trim() || "";
    const json = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(json) as StrategyResult;
  } catch (error) {
    console.error("Company Brain fallback:", error);
    return fallback(command);
  }
}
