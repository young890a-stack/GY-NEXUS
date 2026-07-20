import Link from "next/link";
import type { PublicShowcaseVideo } from "@/lib/public-showcase";
import styles from "./PublicVideoGallery.module.css";

export default function PublicVideoGallery({
  videos,
  compact = false,
}: {
  videos: PublicShowcaseVideo[];
  compact?: boolean;
}) {
  const visible = compact ? videos.slice(0, 3) : videos;

  if (!visible.length) {
    return (
      <div className={styles.empty}>
        <span>GY VIDEO SHOWCASE</span>
        <strong>첫 공개 영상을 준비하고 있습니다.</strong>
        <p>GY Revenue Shorts OS에서 완성 MP4를 만든 뒤 ‘사이트 영상 전시장에 공개’를 누르면 이곳에 자동으로 표시됩니다.</p>
        <Link href="/support">쇼핑 쇼츠 제작 문의</Link>
      </div>
    );
  }

  return (
    <div className={compact ? `${styles.grid} ${styles.compact}` : styles.grid}>
      {visible.map((video) => (
        <article className={styles.card} key={video.id}>
          <div className={styles.videoShell}>
            <video
              src={video.videoUrl}
              poster={video.posterUrl || undefined}
              controls
              playsInline
              preload="metadata"
            >
              브라우저에서 영상을 재생할 수 없습니다.
            </video>
            <span>{Math.round(video.durationSeconds)}초 쇼핑 쇼츠</span>
          </div>
          <div className={styles.body}>
            <small>GY SALES VIDEO</small>
            <h3>{video.title}</h3>
            <strong>{video.productName}</strong>
            <p>{video.productDescription}</p>
            <div className={styles.actions}>
              {video.affiliateUrl && (
                <a href={video.affiliateUrl} target="_blank" rel="sponsored noreferrer">
                  상품 보러가기
                </a>
              )}
              <Link href={`/support?type=ad&video=${encodeURIComponent(video.id)}`}>
                이런 영상 제작 문의
              </Link>
            </div>
            {video.affiliateUrl && (
              <em>제휴 활동을 통해 일정액의 수수료를 제공받을 수 있습니다.</em>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
