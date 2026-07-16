export type QualityResult = {
  total: number;
  factuality: number;
  readability: number;
  seo: number;
  brand: number;
  compliance: number;
  publishable: boolean;
  issues: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
export function scoreContent(input: { title: string; body: string; keywords?: string[] }): QualityResult {
  const text = `${input.title} ${input.body}`.trim();
  const length = input.body.replace(/\s/g, "").length;
  const sentences = input.body.split(/[.!?。\n]+/).filter(Boolean);
  const avgSentence = sentences.length ? input.body.length / sentences.length : input.body.length;
  const headings = (input.body.match(/^#{1,3}\s|<h[1-3]/gim) || []).length;
  const faq = /FAQ|자주 묻는 질문|Q\./i.test(input.body);
  const risky = /(무조건|100%|완치|최고의 수익|보장합니다|절대 손해)/g.test(text);
  const duplicates = new Set(sentences.map((s) => s.trim())).size < Math.max(1, sentences.length * .82);
  const factuality = clamp(94 - (risky ? 28 : 0));
  const readability = clamp(96 - Math.max(0, avgSentence - 55) * .45 - (duplicates ? 12 : 0));
  const seo = clamp(55 + Math.min(20, headings * 5) + (faq ? 10 : 0) + (length >= 1800 ? 15 : length / 120));
  const brand = clamp(92 - (duplicates ? 10 : 0));
  const compliance = clamp(98 - (risky ? 35 : 0));
  const total = clamp(factuality * .25 + readability * .2 + seo * .25 + brand * .15 + compliance * .15);
  const issues: string[] = [];
  if (length < 1500) issues.push("본문 분량이 짧습니다. 핵심 설명과 실제 사례를 보강하세요.");
  if (!headings) issues.push("H2·H3 구조가 없습니다.");
  if (!faq) issues.push("FAQ를 추가하면 검색 의도 충족에 도움이 됩니다.");
  if (risky) issues.push("확인되지 않은 보장·과장 표현이 감지되었습니다.");
  if (duplicates) issues.push("중복되는 문장 표현을 줄이세요.");
  return { total, factuality, readability, seo, brand, compliance, publishable: total >= 90 && !risky, issues };
}
