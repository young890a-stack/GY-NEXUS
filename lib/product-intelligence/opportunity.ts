export type OpportunityInputs = {
  demand: number;
  seasonality: number;
  priceAppeal: number;
  visualDemo: number;
  audienceFit: number;
  commissionPotential: number;
  competition: number;
  policyRisk: number;
  dataConfidence: number;
};

export type OpportunityResult = OpportunityInputs & {
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  recommendation: "우선 제작" | "검토 후 제작" | "보류";
  reasons: string[];
  risks: string[];
};

function clamp(value: unknown, fallback = 50) {
  const number = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(number) ? Math.round(number) : fallback));
}

export function calculateOpportunity(input: Partial<OpportunityInputs>): OpportunityResult {
  const values: OpportunityInputs = {
    demand: clamp(input.demand),
    seasonality: clamp(input.seasonality),
    priceAppeal: clamp(input.priceAppeal),
    visualDemo: clamp(input.visualDemo),
    audienceFit: clamp(input.audienceFit),
    commissionPotential: clamp(input.commissionPotential),
    competition: clamp(input.competition),
    policyRisk: clamp(input.policyRisk, 20),
    dataConfidence: clamp(input.dataConfidence, 60),
  };

  const positive =
    values.demand * 0.20 +
    values.seasonality * 0.10 +
    values.priceAppeal * 0.12 +
    values.visualDemo * 0.15 +
    values.audienceFit * 0.16 +
    values.commissionPotential * 0.17 +
    values.dataConfidence * 0.10;
  const penalty = values.competition * 0.12 + values.policyRisk * 0.13;
  const score = Math.max(0, Math.min(100, Math.round(positive - penalty + 25)));
  const grade = score >= 85 ? "S" : score >= 75 ? "A" : score >= 62 ? "B" : score >= 48 ? "C" : "D";
  const recommendation = score >= 75 ? "우선 제작" : score >= 58 ? "검토 후 제작" : "보류";

  const ranked = [
    [values.demand, "수요 신호가 좋습니다."],
    [values.visualDemo, "쇼츠에서 시각적으로 보여주기 좋습니다."],
    [values.audienceFit, "GY-NEXUS의 20~40대 핵심 타깃과 잘 맞습니다."],
    [values.commissionPotential, "제휴 수익 기회가 상대적으로 좋습니다."],
    [values.priceAppeal, "가격 매력도를 콘텐츠로 설명하기 좋습니다."],
  ] as const;
  const reasons = [...ranked].sort((a, b) => b[0] - a[0]).slice(0, 3).map((item) => item[1]);
  const risks: string[] = [];
  if (values.competition >= 70) risks.push("경쟁 강도가 높아 차별화된 훅이 필요합니다.");
  if (values.policyRisk >= 55) risks.push("광고·표현 정책 검수를 강화해야 합니다.");
  if (values.dataConfidence < 50) risks.push("입력 데이터가 부족해 점수 신뢰도가 낮습니다.");
  if (risks.length === 0) risks.push("현재 입력 기준으로 큰 운영 위험은 확인되지 않았습니다.");

  return { ...values, score, grade, recommendation, reasons, risks };
}
