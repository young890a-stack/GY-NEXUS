import ShortsProductionHub from "@/components/shorts-hub/ShortsProductionHub";

export const metadata = {
  title: "한국형 쇼핑 쇼츠 제작 | Dream Y | GY-NEXUS",
  description: "상품 전략, AI 장면, 한국어 음성·자막, 최종 MP4와 비공개 게시까지 이어지는 쇼핑 쇼츠 제작실입니다.",
};

type Mode = "manual" | "guided" | "auto";

export default async function KoreanShortsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; url?: string }>;
}) {
  const query = await searchParams;
  const initialMode: Mode = query.mode === "auto" || query.mode === "manual" ? query.mode : "guided";
  const initialAffiliateUrl = typeof query.url === "string" ? query.url : "";
  return <ShortsProductionHub initialMode={initialMode} initialAffiliateUrl={initialAffiliateUrl} />;
}
