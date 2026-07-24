import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/product";
import styles from "./products.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "쇼츠로 확인하는 추천상품",
  description:
    "영상과 핵심 설명으로 먼저 확인하고 판매처에서 현재 가격을 비교할 수 있는 GY Labs 추천상품입니다.",
};

const categories = [
  ["all", "전체"],
  ["life-cleaning", "생활·청소"],
  ["digital-electronics", "디지털·전자기기"],
  ["laptop-tablet", "노트북·태블릿"],
  ["deals", "할인·기획"],
  ["etc", "기타"],
] as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const params = await searchParams;
  const q = (params.q || "").trim().toLowerCase();
  const selectedCategory = params.category || "all";
  let products: Product[] = [];
  let message = "";

  if (hasSupabaseEnv()) {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("products")
        .select("id,slug,title,description,image_url,platform,price_text,category,status,is_public,is_featured,quality_score,target_audience,selling_points,usage_tips,cautions,short_video_url,long_video_url,review_url,link_status,price_checked_at,published_at,updated_at,created_at,affiliate_url")
        .eq("is_public", true)
        .eq("status", "published")
        .order("is_featured", { ascending: false })
        .order("quality_score", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(120);
      if (selectedCategory !== "all") query = query.eq("category", selectedCategory);
      const { data, error } = await query;
      if (error) throw error;
      products = (data ?? []) as Product[];
      if (q) products = products.filter((item) => `${item.title} ${item.description || ""} ${item.target_audience || ""}`.toLowerCase().includes(q));
    } catch (error) {
      message = error instanceof Error ? error.message : "상품을 불러오지 못했습니다.";
    }
  } else {
    message = "관리자가 아직 데이터베이스 연결을 완료하지 않았습니다.";
  }

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.section}>
        <div className="container">
          <header className={styles.head}>
            <span>GY CURATED STORE</span>
            <h1>쇼츠로 확인하는 공개 추천상품</h1>
            <p>대표가 품질과 링크 상태를 확인한 상품만 공개합니다. 로그인 없이 영상과 설명을 보고 판매처로 이동할 수 있습니다.</p>
          </header>

          <form className={styles.searchBar} action="/products">
            <input name="q" defaultValue={params.q || ""} placeholder="상품명·사용 상황 검색" aria-label="상품 검색" />
            <input type="hidden" name="category" value={selectedCategory} />
            <button type="submit">검색</button>
          </form>

          <nav className={styles.categories} aria-label="상품 카테고리">
            {categories.map(([value, label]) => (
              <Link key={value} className={selectedCategory === value ? styles.activeCategory : ""} href={`/products?category=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>{label}</Link>
            ))}
          </nav>

          {message && <div className="alert alert-warning" style={{ marginBottom: 20 }}>{message}</div>}

          <div className={styles.grid}>
            {products.map((product) => (
              <article className={styles.card} key={product.id}>
                <Link className={styles.media} href={`/products/${product.slug}`} aria-label={`${product.title} 상세보기`}>
                  {product.short_video_url ? (
                    <video src={product.short_video_url} poster={product.image_url || undefined} muted playsInline preload="metadata" />
                  ) : product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt={product.title} />
                  ) : <div>영상·이미지 준비 중</div>}
                </Link>
                <div className={styles.body}>
                  <div className={styles.badges}>
                    <span>{product.platform || "추천"}</span>
                    {product.is_featured && <span>대표 추천</span>}
                    {product.quality_score >= 90 && <span>품질 우수</span>}
                  </div>
                  <h2><Link href={`/products/${product.slug}`}>{product.title}</Link></h2>
                  <p>{product.description || "주요 특징과 실제 사용 장면을 상세페이지에서 확인해보세요."}</p>
                  {product.price_text && <strong>{product.price_text}</strong>}
                  <small>가격은 변동될 수 있습니다. 판매처에서 현재 가격을 확인하세요.</small>
                  <div className={styles.actions}>
                    <Link href={`/products/${product.slug}`}>상세보기</Link>
                    <Link href={`/go/${product.slug}?source=product_list`} target="_blank" rel="sponsored noopener">현재 가격 확인</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!products.length && !message && <div className="card empty">조건에 맞는 공개 상품이 없습니다.</div>}
          <p className={styles.disclosure}>이 페이지에는 제휴링크가 포함되어 있으며, 링크를 통한 구매 시 운영자에게 일정 수수료가 제공될 수 있습니다. 구매자에게 추가 비용은 발생하지 않습니다.</p>
        </div>
      </main>
    </div>
  );
}
