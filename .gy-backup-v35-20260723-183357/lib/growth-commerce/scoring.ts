export type LearningSignal = {
  views: number;
  engagedViews: number;
  averageViewDuration: number;
  averageViewPercentage: number;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

export function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function commerceScore(signal: LearningSignal) {
  const retention = Math.min(100, signal.averageViewPercentage || 0);
  const engagementRate = signal.views > 0
    ? ((signal.likes + signal.comments * 2 + signal.shares * 3) / signal.views) * 100
    : 0;
  const clickRate = signal.views > 0 ? (signal.clicks / signal.views) * 100 : 0;
  const conversionRate = signal.clicks > 0 ? (signal.conversions / signal.clicks) * 100 : 0;
  const revenueSignal = Math.min(100, Math.log10(Math.max(1, signal.revenue + 1)) * 18);
  return Math.round(Math.min(100,
    retention * 0.32 +
    Math.min(100, engagementRate * 12) * 0.16 +
    Math.min(100, clickRate * 20) * 0.22 +
    Math.min(100, conversionRate * 10) * 0.2 +
    revenueSignal * 0.1,
  ));
}

export function titlePattern(title: string) {
  const value = title.trim();
  if (/\d/.test(value)) return "number";
  if (/왜|이유|비밀|몰랐|충격|결과|반전/.test(value)) return "curiosity";
  if (/vs|비교|대결|TOP|순위/i.test(value)) return "comparison";
  if (/방법|사용법|꿀팁|해결|정리/.test(value)) return "how-to";
  return "direct-benefit";
}

export function durationBucket(seconds: number) {
  if (seconds <= 15) return "0-15s";
  if (seconds <= 20) return "16-20s";
  if (seconds <= 25) return "21-25s";
  if (seconds <= 30) return "26-30s";
  return "31s+";
}
