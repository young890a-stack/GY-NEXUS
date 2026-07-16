import Link from "next/link";
import { hasOpenAIEnv, hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function hasEnv(name: string) {
  const value = process.env[name]?.trim();
  return Boolean(value && !value.includes("여기에") && !value.includes("your_"));
}

export default async function AdminDashboard() {
  const supabaseReady = hasSupabaseEnv();
  const openAiReady = hasOpenAIEnv();
  const geminiReady = hasEnv("GEMINI_API_KEY");

  const externalServices = [
    ["OpenAI", openAiReady],
    ["Quality Engine", true],
    ["Customer Platform", supabaseReady],
    ["Gemini", geminiReady],
    ["Supabase", supabaseReady],
    ["YouTube", hasEnv("YOUTUBE_CLIENT_ID") && hasEnv("YOUTUBE_CLIENT_SECRET")],
    ["Naver", hasEnv("NAVER_ACCESS_TOKEN")],
    ["Coupang", hasEnv("COUPANG_ACCESS_KEY")],
    ["Temu", hasEnv("TEMU_APP_KEY")],
  ] as const;

  const connectedCount = externalServices.filter(([, ready]) => ready).length;

  let productCount = 0;
  let clickCount = 0;
  let contentCount = 0;
  let popular: { id: string; title: string; clicks: number }[] = [];
  let loadError = "";

  if (supabaseReady) {
    try {
      const supabase = await createClient();
      const [{ data: products, error: productError }, contentResult] = await Promise.all([
        supabase
          .from("products")
          .select("id,title,product_clicks(id)")
          .order("created_at", { ascending: false }),
        supabase.from("ai_contents").select("id", { count: "exact", head: true }),
      ]);

      if (productError) throw productError;

      productCount = products?.length ?? 0;
      contentCount = contentResult.count ?? 0;
      clickCount = (products ?? []).reduce(
        (sum, product) => sum + (product.product_clicks?.length ?? 0),
        0
      );
      popular = (products ?? [])
        .map((product) => ({
          id: product.id,
          title: product.title,
          clicks: product.product_clicks?.length ?? 0,
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5);
    } catch (error) {
      loadError =
        error instanceof Error
          ? error.message
          : "대시보드 데이터를 불러오지 못했습니다.";
    }
  }

  const workflow = [
    ["1", "AI 전략회의", "Dream Y가 오늘의 목표와 우선순위를 결정", "/admin/strategy-room"],
    ["2", "상품과 콘텐츠", "인기상품 분석 후 블로그·쇼츠 패키지 생성", "/admin/trends"],
    ["3", "검수·예약·게시", "품질 확인 후 채널과 발행 시간을 지정", "/admin/publishing"],
    ["4", "진화회의", "성과와 실패를 다음 전략에 반영", "/admin/evolution-room"],
  ] as const;

  return (
    <>
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">GY FIRST RELEASE PRODUCTION 1.0</span>
          <h1>GY Company OS 대표 상황실</h1>
          <p>Dream Y가 상품·콘텐츠·품질·고객·게시·성장을 하나의 회사 운영 흐름으로 관리합니다.</p>
        </div>
        <div className="dashboard-actions">
          <Link href="/admin/strategy-room" className="button button-dark">🧠 AI 전략회의 시작</Link>
          <Link href="/admin/products/new" className="button button-primary">+ 새 상품 등록</Link>
        </div>
      </section>

      {!supabaseReady && (
        <div className="alert alert-warning dashboard-alert">
          Supabase 환경변수가 없습니다. <Link href="/admin/settings"><b>설정 안내</b></Link>를 확인하세요.
        </div>
      )}
      {loadError && <div className="alert alert-error dashboard-alert">{loadError}</div>}

      <section className="dashboard-stats">
        <article className="metric-card"><span>📦</span><div><p>등록 상품</p><strong>{productCount}개</strong></div></article>
        <article className="metric-card"><span>🖱️</span><div><p>누적 클릭</p><strong>{clickCount}회</strong></div></article>
        <article className="metric-card"><span>✨</span><div><p>생성 콘텐츠</p><strong>{contentCount}개</strong></div></article>
        <article className="metric-card"><span>🔗</span><div><p>외부 연결</p><strong>{connectedCount}/{externalServices.length}</strong></div></article>
      </section>

      <section className="dashboard-grid-main">
        <article className="dashboard-panel workflow-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">운영 흐름</span><h2>오늘의 AI Company OS 흐름</h2></div>
            <Link href="/admin/automation">자동화 열기 →</Link>
          </div>
          <div className="workflow-grid">
            {workflow.map(([step, title, description, href]) => (
              <Link href={href} className="workflow-card" key={step}>
                <span className="workflow-step">{step}</span>
                <strong>{title}</strong>
                <p>{description}</p>
              </Link>
            ))}
          </div>
        </article>

        <article className="dashboard-panel connection-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">연결 상태</span><h2>외부 서비스</h2></div>
            <Link href="/admin/connections">관리 →</Link>
          </div>
          <div className="service-list">
            {externalServices.map(([name, ready]) => (
              <div className="service-row" key={name}>
                <span>{name}</span>
                <b className={ready ? "ready" : "pending"}>{ready ? "등록 완료" : "설정 필요"}</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-grid-bottom">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">성과</span><h2>인기 상품 TOP 5</h2></div>
            <Link href="/admin/analytics">통계 보기 →</Link>
          </div>
          {popular.length ? (
            <div className="ranking-list">
              {popular.map((item, index) => (
                <div className="ranking-row" key={item.id}>
                  <span className="rank-number">{index + 1}</span>
                  <span className="rank-title">{item.title}</span>
                  <strong>{item.clicks}회</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty compact-empty">상품과 클릭 데이터가 아직 없습니다.</div>
          )}
        </article>

        <article className="dashboard-panel quick-panel">
          <div className="panel-heading"><div><span className="panel-kicker">바로가기</span><h2>빠른 작업</h2></div></div>
          <div className="quick-grid">
            <Link href="/admin/content">🤖<span><b>AI 콘텐츠</b><small>콘텐츠 패키지 생성</small></span></Link>
            <Link href="/admin/import">📥<span><b>상품 자동 등록</b><small>JSON으로 빠르게 등록</small></span></Link>
            <Link href="/admin/publishing">🚀<span><b>자동 게시</b><small>발행 대기열 관리</small></span></Link>
            <Link href="/admin/settings">⚙️<span><b>설정 점검</b><small>API와 DB 상태 확인</small></span></Link>
          </div>
        </article>
      </section>
    </>
  );
}
