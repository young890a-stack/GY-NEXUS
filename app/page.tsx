import GyMotionLanding from "@/components/GyMotionLanding";
import { hasOpenAIEnv, hasSupabaseEnv } from "@/lib/env";

export default function Home() {
  return (
    <GyMotionLanding
      supabaseReady={hasSupabaseEnv()}
      openAiReady={hasOpenAIEnv()}
    />
  );
}
