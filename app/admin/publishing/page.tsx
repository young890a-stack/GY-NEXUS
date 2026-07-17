import PublishingCenter from "@/components/PublishingCenter";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PublishingPage() {
  const supabase = await createClient();
  const [{ data: jobs }, { data: contents }] = await Promise.all([
    supabase.from("publishing_jobs").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("ai_contents").select("id,product_title,title,content,content_type,created_at").order("created_at", { ascending: false }).limit(100),
  ]);

  return <PublishingCenter initialJobs={jobs || []} contents={contents || []} />;
}
