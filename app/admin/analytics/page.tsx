import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("id,title,platform,product_clicks(id,created_at)");
  const rows = (products ?? []).map((product) => ({
    id: product.id,
    title: product.title,
    platform: product.platform || "기타",
    clicks: product.product_clicks?.length ?? 0,
  })).sort((a, b) => b.clicks - a.clicks);
  const total = rows.reduce((sum, row) => sum + row.clicks, 0);

  return <>
    <div className="admin-top"><div><h1>클릭 통계</h1><p>상품별 제휴 링크 유입을 확인합니다.</p></div></div>
    <section className="grid grid-4" style={{ marginBottom: 24 }}>
      <div className="card stat-card"><p>전체 클릭</p><strong>{total}회</strong></div>
      <div className="card stat-card"><p>등록 상품</p><strong>{rows.length}개</strong></div>
      <div className="card stat-card"><p>평균 클릭</p><strong>{rows.length ? (total / rows.length).toFixed(1) : "0"}회</strong></div>
      <div className="card stat-card"><p>최고 성과</p><strong>{rows[0]?.clicks ?? 0}회</strong></div>
    </section>
    <section className="panel">
      <div className="table-wrap"><table><thead><tr><th>순위</th><th>상품</th><th>플랫폼</th><th>클릭</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><b>{row.title}</b></td><td>{row.platform}</td><td>{row.clicks}회</td></tr>)}</tbody></table></div>
    </section>
  </>;
}
