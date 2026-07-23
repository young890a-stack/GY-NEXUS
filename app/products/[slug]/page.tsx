import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/product";
import styles from "./product-detail.module.css";

export const dynamic = "force-dynamic";

async function getProduct(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id,slug,title,description,image_url,platform,price_text,category,status,is_public,is_featured,quality_score,target_audience,selling_points,usage_tips,cautions,short_video_url,long_video_url,review_url,link_status,price_checked_at,published_at,updated_at,created_at,affiliate_url")
    .eq("slug", slug)
    .eq("is_public", true)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;
  return data as Product;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "상품을 찾을 수 없습니다" };
  const description = product.description || `${product.title}의 쇼츠 영상, 특징, 추천 대상과 구매 정보를 확인하세요.`;
  return {
    title: `${product.title} | GY 추천상품`,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: product.title, description, type: "website", images: product.image_url ? [product.image_url] : [] },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const supabase = await createClient();
  const { data: relatedData } = await supabase
    .from("products")
    .select("id,slug,title,image_url,price_text")
    .eq("category", product.category)
    .eq("is_public", true)
    .eq("status", "published")
    .neq("id", product.id)
    .order("quality_score", { ascending: false })
    .limit(4);

  const sellingPoints = Array.isArray(product.selling_points) ? product.selling_points.filter(Boolean) : [];
  const checkedAt = product.price_checked_at ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(product.price_checked_at)) : null;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className="container">
          <Link className={styles.back} href="/products">← 추천상품 전체보기</Link>
          <section className={styles.hero}>
            <div className={styles.media}>
              {product.short_video_url ? (
                <video src={product.short_video_url} poster={product.image_url || undefined} controls playsInline preload="metadata" />
              ) : product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image_url} alt={product.title} />
              ) : <div>영상·이미지 준비 중</div>}
            </div>
            <div className={styles.summary}>
              <div className={styles.badges}><span>{product.platform || "추천"}</span>{product.is_featured && <span>대표 추천</span>}<span>품질 {product.quality_score}점</span></div>
              <h1>{product.title}</h1>
              <p>{product.description || "상품의 주요 특징과 사용 장면을 확인해보세요."}</p>
              {product.price_text && <strong>{product.price_text}</strong>}
              <small>{checkedAt ? `${checkedAt} 기준 표시 정보 · ` : ""}가격과 혜택은 판매처에서 달라질 수 있습니다.</small>
              <Link className={styles.buy} href={`/go/${product.slug}?source=product_detail`} target="_blank" rel="sponsored noopener">판매처에서 현재 가격 확인</Link>
              <p className={styles.disclosure}>이 링크를 통한 구매 시 운영자에게 일정 수수료가 제공될 수 있으며 구매자에게 추가 비용은 발생하지 않습니다.</p>
            </div>
          </section>

          <section className={styles.infoGrid}>
            <article><h2>이런 분께 추천해요</h2><p>{product.target_audience || "일상에서 더 편리하고 효율적인 해결책을 찾는 분께 추천합니다."}</p></article>
            <article><h2>핵심 장점</h2>{sellingPoints.length ? <ul>{sellingPoints.map((point) => <li key={point}>{point}</li>)}</ul> : <p>상세 장점을 준비 중입니다.</p>}</article>
            <article><h2>활용 팁</h2><p>{product.usage_tips || "구매 전 판매 페이지의 구성품과 사용 조건을 함께 확인하세요."}</p></article>
            <article><h2>확인할 점</h2><p>{product.cautions || "가격, 배송, 옵션과 재고는 판매처에서 최종 확인하세요."}</p></article>
          </section>

          {(product.long_video_url || product.review_url) && <section className={styles.contentLinks}><h2>더 자세히 보기</h2><div>{product.long_video_url && <a href={product.long_video_url} target="_blank" rel="noopener noreferrer">상세 쇼츠 보기</a>}{product.review_url && <a href={product.review_url} target="_blank" rel="noopener noreferrer">블로그 리뷰 보기</a>}</div></section>}

          {!!relatedData?.length && <section className={styles.related}><h2>같이 보면 좋은 상품</h2><div>{relatedData.map((item) => <Link key={item.id} href={`/products/${item.slug}`}><span>{item.image_url ? <img src={item.image_url} alt="" /> : "추천"}</span><b>{item.title}</b><small>{item.price_text || "현재 가격 확인"}</small></Link>)}</div></section>}
        </div>
      </main>
    </div>
  );
}
