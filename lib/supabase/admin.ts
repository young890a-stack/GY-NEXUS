import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase 서버 전용 키가 없습니다. SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_SECRET_KEY를 설정해주세요.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
