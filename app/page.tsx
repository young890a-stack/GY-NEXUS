import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const { data, error } = await supabase.from("products").select("*");

  return (
    <main style={{ padding: 40 }}>
      <h1>GY Nexus</h1>

      <p>
        {error
          ? `오류: ${error.message}`
          : `연결 성공! 상품 개수: ${data?.length ?? 0}`}
      </p>
    </main>
  );
}