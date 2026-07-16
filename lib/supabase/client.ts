import { createBrowserClient } from "@supabase/ssr";
import { hasSupabaseEnv } from "@/lib/env";

export function createClient() {
  if (!hasSupabaseEnv()) {
    throw new Error(
      "Supabase 환경변수가 없습니다. .env.local을 먼저 설정해주세요."
    );
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
