export function calculateTrendScore(input: {
  externalRank?: number | null;
  externalScore?: number | null;
  clickCount?: number | null;
  revenue?: number | null;
  conversions?: number | null;
}) {
  const rank = input.externalRank && input.externalRank > 0 ? input.externalRank : 100;
  const rankScore = Math.max(0, 100 - rank);
  const external = Math.max(0, Number(input.externalScore || 0));
  const clicks = Math.log10(1 + Math.max(0, Number(input.clickCount || 0))) * 20;
  const revenue = Math.log10(1 + Math.max(0, Number(input.revenue || 0))) * 15;
  const conversions = Math.log10(1 + Math.max(0, Number(input.conversions || 0))) * 25;
  return Number((rankScore * 0.35 + external * 0.25 + clicks + revenue + conversions).toFixed(2));
}
