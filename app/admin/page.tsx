import { hasOpenAIEnv, hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import OperatingCenter from "./OperatingCenter";

export const dynamic = "force-dynamic";

function hasEnv(name: string) {
  const value = process.env[name]?.trim();
  return Boolean(value && !value.includes("여기에") && !value.includes("your_"));
}

export default async function AdminDashboard() {
  const supabaseReady = hasSupabaseEnv();
  const openAiReady = hasOpenAIEnv();
  const geminiReady = hasEnv("GEMINI_API_KEY");

  const services = [
    { name: "OpenAI", ready: openAiReady, detail: openAiReady ? "AI generation ready" : "API key required" },
    { name: "Supabase", ready: supabaseReady, detail: supabaseReady ? "Database online" : "Database setup needed" },
    { name: "YouTube", ready: hasEnv("YOUTUBE_CLIENT_ID") && hasEnv("YOUTUBE_CLIENT_SECRET"), detail: "OAuth publishing" },
    { name: "Blogger", ready: hasEnv("BLOGGER_CLIENT_ID") || hasEnv("GOOGLE_CLIENT_ID"), detail: "Google publishing" },
    { name: "Naver", ready: hasEnv("NAVER_ACCESS_TOKEN"), detail: "Content channel" },
    { name: "Gemini", ready: geminiReady, detail: "Secondary AI model" },
    { name: "Coupang", ready: hasEnv("COUPANG_ACCESS_KEY"), detail: "Affiliate commerce" },
    { name: "Temu", ready: hasEnv("TEMU_APP_KEY"), detail: "Affiliate commerce" },
  ];

  let productCount = 0;
  let clickCount = 0;
  let contentCount = 0;
  let popular: { id: string; title: string; clicks: number }[] = [];
  let loadError = "";

  if (supabaseReady) {
    try {
      const supabase = await createClient();
      const [{ data: products, error: productError }, contentResult] = await Promise.all([
        supabase.from("products").select("id,title,product_clicks(id)").order("created_at", { ascending: false }),
        supabase.from("ai_contents").select("id", { count: "exact", head: true }),
      ]);
      if (productError) throw productError;
      productCount = products?.length ?? 0;
      contentCount = contentResult.count ?? 0;
      clickCount = (products ?? []).reduce((sum, product) => sum + (product.product_clicks?.length ?? 0), 0);
      popular = (products ?? []).map((product) => ({ id: product.id, title: product.title, clicks: product.product_clicks?.length ?? 0 })).sort((a, b) => b.clicks - a.clicks).slice(0, 5);
    } catch (error) {
      loadError = error instanceof Error ? error.message : "대시보드 데이터를 불러오지 못했습니다.";
    }
  }

  return <OperatingCenter productCount={productCount} clickCount={clickCount} contentCount={contentCount} connectedCount={services.filter((service) => service.ready).length} totalServices={services.length} services={services} popular={popular} loadError={loadError} supabaseReady={supabaseReady} />;
}
