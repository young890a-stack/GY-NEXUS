import PublishingCenter from "@/components/PublishingCenter";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PublishingPage() {
  let jobs: Array<{
    id: string;
    channel: string;
    title: string;
    content: string;
    status: string;
    scheduled_at: string;
    published_at?: string | null;
    last_error?: string | null;
    attempts?: number;
    payload?: { resultUrl?: string | null; isDraft?: boolean } | null;
  }> = [];
  let contents: Array<{
    id: string;
    product_title: string;
    title: string;
    content: string;
    content_type: string;
    created_at: string;
  }> = [];
  let databaseReady = false;

  if (hasSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const [jobsResult, contentsResult] = await Promise.all([
        supabase.from("publishing_jobs").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("ai_contents").select("id,product_title,title,content,content_type,created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      jobs = jobsResult.data || [];
      contents = contentsResult.data || [];
      databaseReady = !jobsResult.error && !contentsResult.error;
    } catch {
      databaseReady = false;
    }
  }

  return <PublishingCenter initialJobs={jobs} contents={contents} databaseReady={databaseReady} />;
}
