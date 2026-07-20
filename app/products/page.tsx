import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getPublicShowcaseVideos } from "@/lib/public-showcase";
import type { Product } from "@/types/product";
import styles from "./products.module.css";

export const dynamic = "force-dynamic";

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s\-_/()[\]]+/g, "");
}

export default async function ProductsPage() {
  let products: Product[] = [];
  let message = "";

  if (hasSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("products")
        .select("*,product_clicks(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      products = (data ?? []) as Product[];
    } catch (error) {
      message = error instanceof Error ? error.message : "상품을 불러오지 못했습니다.";
    }
  } else {
    message = "관리자가 아직 데이터베이스 연결을 완료하지 않았습니다.";
  }

  const videos = await getPublicShowcaseVideos(30);

  return (
    <div className={styles.page}>
      <SiteHeader />
      <section className={styles.section}>
        <div className="container">
          <div className={styles.head}>
            <span>GY SALES PICKS</span>
            <h1>영상으로 확인하는 추천 상품</h1>
            <p>상품 이미지만 보는 대신 실제 쇼핑 쇼츠를 재생하고, 필요할 때 판매 링크로 이동할 수 있습니다.</p>
          </div>

          {message && <div className="alert alert-warning" style={{ marginBottom: 20 }}>{message}</div>}

          <div className={styles.grid}>
            {products.map((product) => {
              const productKey = normalize(product.title);
              const video = videos.find((item) => (
                (item.affiliateUrl && item.affiliateUrl === product.affiliate_url)
                || normalize(item.productName).includes(productKey)
                || productKey.includes(normalize(item.productName))
              ));

              return (
                <article className={styles.card} key={product.id}>
                  <div className={styles.media}>
                    {video ? (
                      <video
                        src={video.videoUrl}
                        poster={video.posterUrl || product.image_url || undefined}
                        controls
                        playsInline
                        preload="metadata"
                      />
                    ) : product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image_url} alt={product.title} />
                    ) : (
                      <div>영상·이미지 준비 중</div>
                    )}
                  </div>
                  <div className={styles.body}>
                    <span>{product.platform || "추천 상품"}</span>
                    <h2>{product.title}</h2>
                    <p>{product.description || "상품의 주요 특징과 사용 장면을 확인해보세요."}</p>
                    {product.price_text && <strong>{product.price_text}</strong>}
                    <div className={styles.actions}>
                      <Link href={`/go?id=${product.id}`} target="_blank">상품 보러가기</Link>
                      <Link href={`/support?type=ad&product=${encodeURIComponent(product.title)}`}>광고 영상 문의</Link>
                    </div>
                    <small>제휴 활동을 통해 일정액의 수수료를 제공받을 수 있습니다. · 누적 클릭 {product.product_clicks?.length ?? 0}회</small>
                  </div>
                </article>
              );
            })}
          </div>

          {!products.length && !message && <div className="card empty">현재 등록된 상품이 없습니다.</div>}
        </div>
      </section>
    </div>
  );
}
