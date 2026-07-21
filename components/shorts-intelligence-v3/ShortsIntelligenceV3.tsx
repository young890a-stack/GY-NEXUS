"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./ShortsIntelligenceV3.module.css";

type Keyword = { simplifiedChinese: string; koreanMeaning: string; intent: string; priority: number };
type KeywordPlan = { translatedProductName: string; keywords: Keyword[]; sellingAngles: string[]; cautions: string[] };
type Dashboard = {
  runs: Array<Record<string, any>>;
  candidates: Array<Record<string, any>>;
  opportunities: Array<Record<string, any>>;
  variants: Array<Record<string, any>>;
  collectorSessions: Array<Record<string, any>>;
};

const emptyDashboard: Dashboard = { runs: [], candidates: [], opportunities: [], variants: [], collectorSessions: [] };

export default function ShortsIntelligenceV3() {
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState(150);
  const [activeRun, setActiveRun] = useState<Record<string, any> | null>(null);
  const [keywordPlan, setKeywordPlan] = useState<KeywordPlan | null>(null);
  const [collectorToken, setCollectorToken] = useState("");
  const [manualKeywordPrompt, setManualKeywordPrompt] = useState("");
  const [manualKeywordJson, setManualKeywordJson] = useState("");
  const [manualAnalysisPrompt, setManualAnalysisPrompt] = useState("");
  const [manualAnalysisJson, setManualAnalysisJson] = useState("");
  const [manualAnalysisIds, setManualAnalysisIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/shorts-intelligence-v3/dashboard", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "운영현황을 불러오지 못했습니다.");
      setDashboard(data);
      if (!activeRun && data.runs?.[0]) setActiveRun(data.runs[0]);
      if (activeRun) {
        const refreshed = data.runs?.find((item: Record<string, any>) => item.id === activeRun.id);
        if (refreshed) setActiveRun(refreshed);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "운영현황을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createRunWithPlan(plan: KeywordPlan, provider: string, model: string) {
    const response = await fetch("/api/shorts-intelligence-v3/discovery-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        targetCandidateCount: target,
        platforms: ["douyin", "xiaohongshu"],
        translatedProductName: plan.translatedProductName,
        keywordPlan: plan.keywords,
        geminiProvider: provider,
        geminiModel: model,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "수집 작업 생성 실패");
    setActiveRun({ ...data.run, gemini_provider: provider, gemini_model: model });
    setKeywordPlan(plan);
    await createCollectorSession(data.run.id);
    setMessage("V3-2 수집 작업과 12시간 수집 연결키를 만들었습니다. Edge 확장 프로그램에 연결 설정을 붙여 넣으세요.");
    setQuery("");
    await load();
  }

  async function createRun(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setManualKeywordPrompt("");
    try {
      const response = await fetch("/api/shorts-intelligence-v3/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode: "auto" }),
      });
      const data = await response.json();
      if (response.status === 409 && data.manualPrompt) {
        setManualKeywordPrompt(data.manualPrompt);
        setMessage("Gemini API 키가 없어 Gemini Pro 직접 사용 모드가 열렸습니다. 프롬프트를 Gemini Pro에 붙여 넣고 JSON 결과를 아래에 넣어주세요.");
        return;
      }
      if (!response.ok || !data.success) throw new Error(data.message || "검색어 생성 실패");
      await createRunWithPlan(data.plan, data.provider, data.model);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "수집 작업 생성 실패");
    } finally {
      setBusy(false);
    }
  }

  async function importManualKeywordPlan() {
    setBusy(true);
    try {
      const planInput = JSON.parse(manualKeywordJson);
      const response = await fetch("/api/shorts-intelligence-v3/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode: "manual-import", plan: planInput }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Gemini Pro 결과 확인 실패");
      await createRunWithPlan(data.plan, data.provider, data.model);
      setManualKeywordPrompt("");
      setManualKeywordJson("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "JSON 결과를 확인해주세요.");
    } finally {
      setBusy(false);
    }
  }


  async function createCollectorSession(runId = activeRun?.id) {
    if (!runId) throw new Error("수집 작업을 먼저 선택해주세요.");
    const sessionResponse = await fetch("/api/shorts-intelligence-v3/collector-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    const sessionData = await sessionResponse.json();
    if (!sessionResponse.ok || !sessionData.success) throw new Error(sessionData.message || "수집 연결키 생성 실패");
    setCollectorToken(sessionData.collectorToken);
    setMessage("12시간 수집 연결키를 새로 만들었습니다. 기존 연결키는 자동 취소되었습니다.");
    await load();
  }

  function collectorConfig() {
    return JSON.stringify({
      apiBase: window.location.origin,
      runId: activeRun?.id || "",
      collectorToken,
      target: activeRun?.target_candidate_count || target,
    }, null, 2);
  }

  async function copyText(value: string, success: string) {
    await navigator.clipboard.writeText(value);
    setMessage(success);
  }

  async function analyzeAutomatically() {
    if (!activeRun?.id) return;
    setBusy(true);
    setMessage("Gemini API로 후보를 12개씩 분석하고 있습니다.");
    try {
      let total = 0;
      let remaining = 1;
      for (let batch = 0; batch < 10 && remaining > 0; batch += 1) {
        const response = await fetch("/api/shorts-intelligence-v3/candidates/analyze", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: activeRun.id, mode: "auto", limit: 12 }),
        });
        const data = await response.json();
        if (response.status === 409 && data.manualPrompt) {
          setManualAnalysisPrompt(data.manualPrompt);
          setMessage("Gemini API 키가 없어 Gemini Pro 직접 분석 자료를 만들었습니다.");
          return;
        }
        if (!response.ok || !data.success) throw new Error(data.message || "Gemini 분석 실패");
        total += Number(data.analyzed || 0);
        remaining = Number(data.remaining || 0);
        if (!data.analyzed) break;
      }
      setMessage(`Gemini 자동 분석 ${total}개 완료. 남은 후보 ${remaining}개.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gemini 분석 실패");
    } finally {
      setBusy(false);
    }
  }

  async function exportManualAnalysis() {
    if (!activeRun?.id) return;
    setBusy(true);
    try {
      const response = await fetch("/api/shorts-intelligence-v3/candidates/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: activeRun.id, mode: "manual-export", limit: 12 }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "분석 자료 생성 실패");
      setManualAnalysisPrompt(data.manualPrompt || "");
      setManualAnalysisIds(Array.isArray(data.candidates) ? data.candidates.map((item: Record<string, any>) => String(item.id)) : []);
      setMessage("아래 분석자료를 Gemini Pro에 붙여 넣고 JSON 결과를 다시 가져오세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "분석 자료 생성 실패");
    } finally { setBusy(false); }
  }

  async function importManualAnalysis() {
    if (!activeRun?.id) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(manualAnalysisJson);
      const results = Array.isArray(parsed) ? parsed : parsed.candidates;
      const response = await fetch("/api/shorts-intelligence-v3/candidates/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: activeRun.id, mode: "manual-import", limit: 12, candidateIds: manualAnalysisIds, results }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Gemini Pro 결과 저장 실패");
      setManualAnalysisJson("");
      setManualAnalysisPrompt("");
      setManualAnalysisIds([]);
      setMessage(`Gemini Pro 분석 ${data.analyzed}개 저장 완료. 남은 후보 ${data.remaining}개.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gemini Pro JSON 결과를 확인해주세요.");
    } finally { setBusy(false); }
  }

  const verified30 = useMemo(() => dashboard.opportunities.filter((item) => item.high_commission_eligible), [dashboard.opportunities]);
  const topCandidates = dashboard.candidates.slice(0, 8);
  const activeSession = dashboard.collectorSessions.find((item) => item.run_id === activeRun?.id);
  const activeKeywords: Keyword[] = keywordPlan?.keywords || (Array.isArray(activeRun?.keyword_plan) ? activeRun.keyword_plan : []);
  const collected = Number(activeRun?.collected_candidate_count || activeSession?.collected_candidate_count || 0);
  const targetCount = Number(activeRun?.target_candidate_count || target);
  const analyzed = Number(activeRun?.analyzed_candidate_count || 0);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span>GY-NEXUS V3-2</span>
          <h1>Gemini Pro China Discovery Engine</h1>
          <p>도우인·샤오홍슈 로그인 화면의 공개 카드 100~300개를 안전하게 모으고, Gemini Pro 또는 Gemini API로 수익화 가능성을 선별합니다.</p>
        </div>
        <div className={styles.actionRow}><a className={styles.linkButton} href="/admin/shorts-intelligence-v3/scene-intelligence">V3-3 장면 분석실</a><button className={styles.refresh} onClick={() => void load()} disabled={loading}>{loading ? "불러오는 중" : "새로고침"}</button></div>
      </header>

      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.metrics}>
        <article><b>{collected}/{targetCount}</b><span>현재 수집 진행</span></article>
        <article><b>{analyzed}</b><span>Gemini 분석 완료</span></article>
        <article><b>{dashboard.candidates.length}</b><span>상위 분석 후보</span></article>
        <article><b>{verified30.length}</b><span>검증된 30%+ 후보</span></article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><span>STEP 1</span><h2>Gemini 검색어 + 대량 수집 작업</h2></div>
          <small>기본 150개 · 최소 100개 · 최대 300개</small>
        </div>
        <form className={styles.searchForm} onSubmit={createRun}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 휴대용 냉풍기, 세탁조 클리너" minLength={2} required />
          <select value={target} onChange={(event) => setTarget(Number(event.target.value))}>
            <option value={100}>100개</option><option value={150}>150개</option><option value={200}>200개</option><option value={300}>300개</option>
          </select>
          <button disabled={busy}>{busy ? "준비 중" : "V3-2 수집 준비"}</button>
        </form>
        {manualKeywordPrompt && <div className={styles.manualBox}>
          <h3>Gemini Pro 직접 검색어 생성</h3>
          <textarea readOnly value={manualKeywordPrompt} />
          <button onClick={() => void copyText(manualKeywordPrompt, "Gemini Pro용 프롬프트를 복사했습니다.")}>프롬프트 복사</button>
          <textarea value={manualKeywordJson} onChange={(event) => setManualKeywordJson(event.target.value)} placeholder="Gemini Pro가 만든 JSON을 여기에 붙여넣기" />
          <button onClick={() => void importManualKeywordPlan()} disabled={!manualKeywordJson.trim() || busy}>JSON 확인 후 수집 시작</button>
        </div>}
      </section>

      {activeRun && <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>STEP 2</span><h2>Edge 수집 도우미 연결</h2></div><small>토큰은 12시간 후 자동 만료</small></div>
        <div className={styles.progress}><i style={{ width: `${Math.min(100, (collected / Math.max(1, targetCount)) * 100)}%` }} /></div>
        <p className={styles.muted}>작업 ID: {activeRun.id} · 수집 {collected}/{targetCount} · 상태 {activeRun.collector_status || activeRun.status}</p>
        <div className={styles.actionRow}>
          <a className={styles.linkButton} href="/downloads/GY-NEXUS-V3-2-COLLECTOR-EXTENSION.zip">Edge 수집 도우미 다운로드</a>
          <button onClick={() => void createCollectorSession()} disabled={busy}>새 수집 연결키 만들기</button>
          <button onClick={() => void copyText(collectorConfig(), "수집 연결 설정을 복사했습니다.")} disabled={!collectorToken}>수집 연결 설정 복사</button>
        </div>
        {activeKeywords.length > 0 && <div className={styles.keywordGrid}>{activeKeywords.map((item) => <article key={item.simplifiedChinese}>
          <b>{item.simplifiedChinese}</b><span>{item.koreanMeaning}</span>
          <div><a target="_blank" rel="noreferrer" href={`https://www.douyin.com/search/${encodeURIComponent(item.simplifiedChinese)}?type=video`}>도우인</a><a target="_blank" rel="noreferrer" href={`https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(item.simplifiedChinese)}&source=web_search_result_notes`}>샤오홍슈</a></div>
        </article>)}</div>}
      </section>}

      {activeRun && <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>STEP 3</span><h2>Gemini 수익화 1차 선별</h2></div><small>카드 메타데이터 분석이며 실제 영상 장면 정밀분석은 V3-3에서 수행</small></div>
        <div className={styles.actionRow}>
          <button onClick={() => void analyzeAutomatically()} disabled={busy || !collected}>Gemini API 자동 분석</button>
          <button onClick={() => void exportManualAnalysis()} disabled={busy || !collected}>Gemini Pro 분석자료 만들기</button>
        </div>
        {manualAnalysisPrompt && <div className={styles.manualBox}>
          <textarea readOnly value={manualAnalysisPrompt} />
          <button onClick={() => void copyText(manualAnalysisPrompt, "Gemini Pro 분석자료를 복사했습니다.")}>분석자료 복사</button>
          <textarea value={manualAnalysisJson} onChange={(event) => setManualAnalysisJson(event.target.value)} placeholder="Gemini Pro가 반환한 JSON을 여기에 붙여넣기" />
          <button onClick={() => void importManualAnalysis()} disabled={!manualAnalysisJson.trim() || busy}>분석 결과 저장</button>
        </div>}
      </section>}

      <section className={styles.columns}>
        <div className={styles.panel}>
          <div className={styles.panelHead}><div><span>INTELLIGENCE</span><h2>상위 영상 후보</h2></div></div>
          <div className={styles.list}>
            {topCandidates.map((item) => <article className={styles.candidate} key={item.id}>
              <div className={styles.thumb}>{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" /> : <span>{item.platform}</span>}</div>
              <div><b>{item.title || "제목 없음"}</b><p>{item.platform} · 종합 {item.total_intelligence_score}점 · Gemini {item.gemini_score || 0}점 · {item.gemini_status || "pending"}</p></div>
            </article>)}
            {!topCandidates.length && <p className={styles.empty}>아직 수집된 후보가 없습니다.</p>}
          </div>
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHead}><div><span>PROFIT</span><h2>30% 이상 검증 상품</h2></div></div>
          <div className={styles.list}>
            {verified30.slice(0, 6).map((item) => <article className={styles.profit} key={item.id}><div><b>{item.products?.title || item.affiliate_platform}</b><p>수수료 {item.commission_rate}% · 순이익 예상 {Number(item.expected_net_profit || 0).toLocaleString("ko-KR")}원</p></div><strong>{item.profit_score}점</strong></article>)}
            {!verified30.length && <p className={styles.empty}>수수료 근거가 확인된 30% 이상 상품이 아직 없습니다.</p>}
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>SAFETY</span><h2>수집·권리 보호 원칙</h2></div></div>
        <div className={styles.gate}>로그인 화면에 보이는 공개 카드 메타데이터만 수집합니다. 비밀번호·쿠키·개인 메시지를 전송하지 않으며, 권리 미확인 원본 영상은 최종 쇼츠에 사용하지 않습니다.</div>
      </section>
    </div>
  );
}
