import Link from "next/link";
import styles from "./ShortsTrackHub.module.css";

const koreanSteps = [
  "상품·제휴링크 불러오기",
  "Dream Y 키워드·훅·대본 생성",
  "상품 사진·직접 촬영 영상 연결",
  "Gemini 좋은 구간 자동 선별",
  "음성·음악·자막·장면 제작",
  "미리캔버스 썸네일 패키지",
  "최종 MP4·CapCut 작업 패키지",
  "게시 성과 학습",
];

const chinaSteps = [
  "한국 상품명 → 중국어 검색어 생성",
  "도우인·샤오홍슈 인기 구조 탐색",
  "후보 영상·키워드·반응 지표 분석",
  "사용 권한과 원본 사용 범위 확인",
  "Gemini 훅·촬영각도·장면 구조 분석",
  "한국형 대본·음성·자막으로 재구성",
  "내 상품 사진·내 영상으로 새 장면 제작",
  "CapCut 마무리·게시 전 검수",
];

const capabilityRows = [
  ["인기 키워드", "AI 키워드·SEO 생성", "중국어 확장어·공개 검색 근거"],
  ["Gemini", "내 영상의 좋은 구간 자동 선별", "후보·장면 구조 분석"],
  ["미리캔버스", "문구·폰트·규격 패키지 제공", "한국형 썸네일 패키지 제공"],
  ["CapCut", "자막·영상·게시문 ZIP 제공", "현지화 편집용 ZIP 제공"],
  ["최종 작업", "대표 확인 후 게시", "권리 확인·한국형 재구성 후 게시"],
];

export default function ShortsTrackHub() {
  return (
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <span>DREAM Y SHORTS PRODUCTION</span>
          <h1>쇼츠 제작센터</h1>
          <p>
            제작 출발점을 먼저 고르면 Dream Y가 각 방식에 맞는 키워드, 대본, 소재,
            편집 패키지와 게시 준비를 한 흐름으로 안내합니다.
          </p>
        </div>
        <div className={styles.heroStatus}>
          <strong>2</strong>
          <span>제작 방식</span>
          <small>한국 직접 제작 · 중국 소스 현지화</small>
        </div>
      </section>

      <section className={styles.trackGrid} aria-label="쇼츠 제작 방식 선택">
        <article className={`${styles.trackCard} ${styles.korean}`}>
          <div className={styles.cardTop}>
            <span>TRACK 01</span>
            <em>권장 시작</em>
          </div>
          <h2>한국형 쇼츠</h2>
          <p>
            쿠팡·Temu 등 상품 정보와 직접 보유한 사진·영상을 중심으로 한국 시청자용
            쇼핑 쇼츠를 새로 만듭니다.
          </p>
          <ol>
            {koreanSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <Link href="/admin/korean-shorts">한국형 쇼츠 제작 시작 <span>→</span></Link>
        </article>

        <article className={`${styles.trackCard} ${styles.china}`}>
          <div className={styles.cardTop}>
            <span>TRACK 02</span>
            <em>권리 확인 필수</em>
          </div>
          <h2>중국 소스 현지화 쇼츠</h2>
          <p>
            샤오홍슈·도우인의 인기 영상과 키워드를 참고해 훅과 판매 구조를 분석하고,
            내 상품 소재로 한국형 쇼츠를 다시 구성합니다.
          </p>
          <ol>
            {chinaSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <Link href="/admin/china-video-lab">중국 소스 탐색 시작 <span>→</span></Link>
        </article>
      </section>

      <section className={styles.realityPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>ACTUAL WORKFLOW</span>
            <h2>현재 실제로 가능한 범위</h2>
          </div>
          <p>외부 편집 서비스까지 전부 자동 조작한다고 과장하지 않고, 자동과 수동 단계를 구분했습니다.</p>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr><th>기능</th><th>한국형 쇼츠</th><th>중국 소스 현지화</th></tr>
            </thead>
            <tbody>
              {capabilityRows.map(([feature, korean, china]) => (
                <tr key={feature}><th>{feature}</th><td>{korean}</td><td>{china}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.manualNotes}>
          <article>
            <b>미리캔버스</b>
            <span>Dream Y가 문구·폰트·레이아웃·규격 파일을 만들고, 최종 디자인은 미리캔버스에서 확인합니다.</span>
          </article>
          <article>
            <b>CapCut</b>
            <span>영상·자막·게시문이 담긴 가져오기 패키지를 만들고, CapCut에서 최종 편집과 내보내기를 합니다.</span>
          </article>
          <article>
            <b>샤오홍슈·도우인</b>
            <span>인기 구조를 분석하는 참고 소스입니다. 원본 사용은 권리 확인이 된 자료만 허용합니다.</span>
          </article>
        </div>
      </section>
    </div>
  );
}
