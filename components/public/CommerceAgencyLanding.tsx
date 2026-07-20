import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import PublicVideoGallery from "@/components/public/PublicVideoGallery";
import type { PublicShowcaseVideo } from "@/lib/public-showcase";
import styles from "./CommerceAgencyLanding.module.css";

const services = [
  {
    number: "01",
    title: "쇼핑 쇼츠 제작",
    text: "상품 분석부터 15~30초 영상, 정확한 한국어 자막, 썸네일, 제목과 판매 문구까지 한 번에 제작합니다.",
  },
  {
    number: "02",
    title: "상품 광고 대행",
    text: "쿠팡·테무·네이버 등 판매 링크와 연결되는 영상 광고 소재를 만들고 고객이 구매까지 이동할 수 있게 설계합니다.",
  },
  {
    number: "03",
    title: "콘텐츠 운영 대행",
    text: "유튜브 쇼츠·인스타 릴스용 소재를 반복 제작하고, 반응이 좋은 훅과 상품을 중심으로 운영 방향을 보완합니다.",
  },
];

const process = [
  "상품·목표 확인",
  "판매 포인트와 영상 기획",
  "쇼츠·자막·썸네일 제작",
  "상품 링크·광고 문의 연결",
];

export default function CommerceAgencyLanding({
  videos,
}: {
  videos: PublicShowcaseVideo[];
}) {
  const featured = videos[0];

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main>
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={`container ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <span>GY LABS · SHOPPING SHORTS & SALES ADS</span>
              <h1>
                보기 좋은 영상보다,
                <br />
                <em>상품이 팔리는 영상</em>을 만듭니다.
              </h1>
              <p>
                GY Labs는 쇼핑 쇼츠 제작, 상품 광고 영상, 제휴 링크 연결과
                판매 콘텐츠 운영을 한 흐름으로 제공하는 상품 판매 전문 스튜디오입니다.
              </p>
              <div className={styles.heroActions}>
                <Link href="/showcase">영상 포트폴리오 보기</Link>
                <Link href="/support?type=ad">광고 제작 문의</Link>
              </div>
              <div className={styles.proofs}>
                <div><strong>15~30초</strong><span>상품별 최적 길이</span></div>
                <div><strong>정확한 자막</strong><span>검수형 한국어 SRT</span></div>
                <div><strong>판매 연결</strong><span>상품 링크·문의 CTA</span></div>
              </div>
            </div>

            <div className={styles.heroVideo}>
              {featured ? (
                <>
                  <video
                    src={featured.videoUrl}
                    poster={featured.posterUrl || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    controls
                    preload="metadata"
                  />
                  <div>
                    <span>NOW PLAYING</span>
                    <strong>{featured.title}</strong>
                    <small>소리를 켜고 실제 쇼핑 쇼츠를 확인하세요.</small>
                  </div>
                </>
              ) : (
                <div className={styles.videoEmpty}>
                  <span>GY SALES VIDEO</span>
                  <strong>완성 영상이 이곳에서 바로 재생됩니다.</strong>
                  <p>Revenue Shorts OS에서 공개 버튼을 누르면 메인 대표 영상으로 자동 연결됩니다.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className={styles.videoSection}>
          <div className="container">
            <div className={styles.sectionHead}>
              <div>
                <span>VIDEO PORTFOLIO</span>
                <h2>영상으로 먼저 확인하고,<br />상품과 제작 문의로 연결합니다.</h2>
              </div>
              <Link href="/showcase">전체 영상 보기 →</Link>
            </div>
            <PublicVideoGallery videos={videos} compact />
          </div>
        </section>

        <section className={styles.services}>
          <div className="container">
            <div className={styles.sectionHead}>
              <div>
                <span>WHAT WE DO</span>
                <h2>1차 사업은 명확합니다.<br />쇼핑 쇼츠와 상품 광고 대행.</h2>
              </div>
              <p>기능을 보여주는 사이트가 아니라, 고객이 영상을 보고 상품을 구매하거나 광고 제작을 의뢰하는 사이트로 운영합니다.</p>
            </div>
            <div className={styles.serviceGrid}>
              {services.map((service) => (
                <article key={service.number}>
                  <span>{service.number}</span>
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.process}>
          <div className="container">
            <div className={styles.sectionHead}>
              <div>
                <span>SALES FLOW</span>
                <h2>상품 하나가 판매 콘텐츠가 되는 과정</h2>
              </div>
            </div>
            <div className={styles.processGrid}>
              {process.map((item, index) => (
                <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>
              ))}
            </div>
          </div>
        </section>

        <section className={`container ${styles.cta}`}>
          <div>
            <span>START YOUR SALES VIDEO</span>
            <h2>판매하고 싶은 상품이 있다면,<br />영상부터 달라져야 합니다.</h2>
            <p>상품 링크와 원하는 영상 방향을 보내주시면 쇼핑 쇼츠·광고 영상 제작 흐름으로 안내합니다.</p>
          </div>
          <Link href="/support?type=ad">광고 제작 상담 시작</Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className="container">
          <div><strong>GY LABS</strong><span>Shopping Shorts · Sales Video · Commerce Ads</span></div>
          <small>상품 판매를 위한 영상 콘텐츠 전문 스튜디오</small>
        </div>
      </footer>
    </div>
  );
}
