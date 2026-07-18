import AutomationEngine from "@/components/automation/AutomationEngine";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  const supabase = createAdminClient();
  const [{ data: products }, { data: jobs }, { data: logs }] = await Promise.all([
    supabase.from("products").select("id,title").order("created_at", { ascending: false }).limit(100),
    supabase.from("automation_jobs").select("*, products(title)").order("created_at", { ascending: false }).limit(50),
    supabase.from("automation_job_logs").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  return <div className="admin-page">
    <div className="admin-top"><div><span className="eyebrow">SPRINT 6 · AUTOMATION ENGINE</span><h1>AI 회사 자동 운영 엔진</h1><p>OpenAI → 이미지 → Runway → Blogger → YouTube를 작업 큐와 실행 로그로 안전하게 연결합니다.</p></div></div>
    <AutomationEngine products={products || []} jobs={jobs || []} logs={logs || []}/>
  </div>;
}
