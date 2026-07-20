import CommerceAgencyLanding from "@/components/public/CommerceAgencyLanding";
import { getPublicShowcaseVideos } from "@/lib/public-showcase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const videos = await getPublicShowcaseVideos(6);
  return <CommerceAgencyLanding videos={videos} />;
}
