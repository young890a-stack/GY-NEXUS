import Link from "next/link";
import CreativeStudioPro from "@/components/creative-studio-pro/CreativeStudioPro";

export const metadata = { title: "쇼핑 쇼츠 제작실 · GY-NEXUS" };

export default function ShoppingShortsPage() {
  return (
    <>
      <section className="panel shopping-shorts-split-banner">
        <div>
          <span>WORKSPACE SEPARATED</span>
          <h1>쇼핑쇼츠 제작실</h1>
          <p>
            중국 영상 검색은 독립된 “중국 영상 연구소”로 분리했습니다.
            이 화면은 상품 프로젝트·AI 컷·대본·자막·음성·영상 제작에만 집중합니다.
          </p>
        </div>
        <Link href="/admin/china-video-lab">중국 영상 연구소 열기</Link>
      </section>

      <div className="shopping-shorts-production-only">
        <CreativeStudioPro shoppingCenterMode />
      </div>

      <style>{`
        .shopping-shorts-split-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 22px;
          padding: clamp(24px, 3vw, 38px);
          border: 1px solid rgba(123, 97, 255, .24);
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(75, 216, 255, .15), transparent 38%),
            linear-gradient(145deg, rgba(17, 23, 46, .98), rgba(8, 12, 27, .98));
        }
        .shopping-shorts-split-banner span {
          color: #80e6ff;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .14em;
        }
        .shopping-shorts-split-banner h1 {
          margin: 8px 0 0;
          font-size: clamp(30px, 4vw, 48px);
          letter-spacing: -.045em;
        }
        .shopping-shorts-split-banner p {
          max-width: 760px;
          margin: 13px 0 0;
          color: #aeb7d6;
          font-size: 17px;
          line-height: 1.7;
        }
        .shopping-shorts-split-banner a {
          flex: 0 0 auto;
          display: inline-flex;
          min-height: 54px;
          align-items: center;
          justify-content: center;
          padding: 0 20px;
          border-radius: 15px;
          background: linear-gradient(135deg, #795cff, #428cff);
          color: white;
          font-weight: 900;
          text-decoration: none;
        }
        .shopping-shorts-production-only .china-source-library {
          display: none !important;
        }
        @media (max-width: 760px) {
          .shopping-shorts-split-banner {
            align-items: stretch;
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}
