"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Id = "youtube" | "blogger" | "naver" | "search-console" | "coupang" | "temu";
type OAuthId = "youtube" | "blogger" | "naver" | "search-console";
type Connection = {
  id: Id;
  name: string;
  connected: boolean;
  configured: boolean;
  detail: string;
  account?: string;
  limitation?: string;
};
type StatusResponse = {
  success: boolean;
  connections: Connection[];
  core?: { openai: boolean; supabase: boolean; encryption: boolean };
};
type Diagnostics = {
  success: boolean;
  siteUrl: string;
  encryptionReady: boolean;
  callbacks: Record<OAuthId, string>;
  checks: Array<{ id: string; label: string; ok: boolean; detail: string }>;
};

const metadata: Record<
  Id,
  { icon: string; purpose: string; env: string[]; start?: string; test?: string }
> = {
  youtube: {
    icon: "▶️",
    purpose: "채널 조회 · 영상 업로드",
    env: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
    start: "/api/connections/youtube/start",
  },
  blogger: {
    icon: "📝",
    purpose: "블로그 조회 · 글 게시",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "BLOGGER_BLOG_ID(선택)"],
    start: "/api/connections/blogger/start",
  },
  naver: {
    icon: "🟢",
    purpose: "로그인 · 콘텐츠 전송 준비",
    env: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
    start: "/api/connections/naver/start",
  },
  "search-console": {
    icon: "📈",
    purpose: "검색 성과 · GA4 통계",
    env: ["SEARCH_CONSOLE_CLIENT_ID", "SEARCH_CONSOLE_CLIENT_SECRET", "GA4_PROPERTY_ID"],
    start: "/api/search-console/start",
  },
  coupang: {
    icon: "🛒",
    purpose: "파트너스 상품 조회 · 제휴 링크",
    env: ["COUPANG_ACCESS_KEY", "COUPANG_SECRET_KEY"],
    test: "/api/connections/coupang/test",
  },
  temu: {
    icon: "🟠",
    purpose: "상품별 제휴 링크 운영",
    env: ["TEMU_AFFILIATE_ID", "TEMU_AFFILIATE_LINK_TEMPLATE"],
    test: "/api/connections/temu/test",
  },
};

const oauthIds = new Set<Id>(["youtube", "blogger", "naver", "search-console"]);
const names: Record<OAuthId, string> = {
  youtube: "YouTube",
  blogger: "Google Blogger",
  naver: "Naver",
  "search-console": "Search Console · GA4",
};

const errorReasons: Record<string, string> = {
  config: "Client ID 또는 Client Secret이 없습니다. 환경변수를 확인하세요.",
  denied: "계정 권한 승인이 취소되었습니다. 다시 연결해 승인해주세요.",
  provider: "외부 서비스가 연결 요청을 거절했습니다. 개발자 콘솔 설정을 확인하세요.",
  network: "외부 서비스 응답을 받지 못했습니다. 잠시 후 연결센터에서 다시 시도하세요.",
  state: "연결 시간이 만료됐거나 다른 주소에서 시작됐습니다. 이 화면에서 다시 연결하세요.",
  token: "콜백 주소 또는 Client Secret이 외부 콘솔과 일치하지 않습니다.",
  storage: "승인은 됐지만 토큰을 안전하게 저장하지 못했습니다. 서버 비밀키를 확인하세요.",
};

export default function ConnectionsManager() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [core, setCore] = useState({ openai: false, supabase: false, encryption: false });
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<Id | "refresh" | "copy-all" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const connectedCount = useMemo(
    () =>
      connections.filter((item) => item.connected).length +
      Number(core.openai) +
      Number(core.supabase),
    [connections, core],
  );
  const totalCount = connections.length + 2;

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statusResponse, diagnosticsResponse] = await Promise.all([
        fetch("/api/connections/status", { cache: "no-store" }),
        fetch("/api/connections/diagnostics", { cache: "no-store" }),
      ]);
      const status = (await statusResponse.json()) as StatusResponse;
      const checks = (await diagnosticsResponse.json()) as Diagnostics;
      if (!statusResponse.ok || !status.success) throw new Error("status");
      setConnections(status.connections);
      setCore(status.core || { openai: false, supabase: false, encryption: false });
      if (diagnosticsResponse.ok && checks.success) setDiagnostics(checks);
    } catch {
      setError("연결 상태를 불러오지 못했습니다. 로그인 상태와 배포 로그를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected") as OAuthId | null;
    const failed = params.get("error") as OAuthId | null;
    const reason = params.get("reason") || "provider";
    if (connected && names[connected]) setMessage(`${names[connected]} 연결이 완료되었습니다.`);
    if (failed && names[failed]) {
      setError(`${names[failed]} 연결 실패: ${errorReasons[reason] || errorReasons.provider}`);
    }
    if (connected || failed) window.history.replaceState({}, "", window.location.pathname);
    void loadStatus();
  }, [loadStatus]);

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
      setError("");
    } catch {
      setError("주소 복사에 실패했습니다. HTTPS 화면에서 다시 시도해주세요.");
    }
  }

  async function disconnect(id: OAuthId) {
    setActionId(id);
    setMessage("");
    setError("");
    const endpoint =
      id === "search-console"
        ? "/api/search-console/disconnect"
        : `/api/connections/${id}/disconnect`;
    try {
      const response = await fetch(endpoint, { method: "POST" });
      if (!response.ok) throw new Error("disconnect");
      setMessage(`${names[id]} 연결을 해제했습니다.`);
      await loadStatus();
    } catch {
      setError("연결 해제에 실패했습니다.");
    } finally {
      setActionId("");
    }
  }

  async function runTest(connection: Connection) {
    const endpoint = metadata[connection.id].test;
    if (!endpoint) return;
    setActionId(connection.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "연결 테스트에 실패했습니다.");
      setMessage(data.message || `${connection.name} 연결 테스트가 통과했습니다.`);
      await loadStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "연결 테스트에 실패했습니다.");
    } finally {
      setActionId("");
    }
  }

  async function refresh() {
    setActionId("refresh");
    await loadStatus();
    setMessage("모든 연결 상태를 다시 확인했습니다.");
    setActionId("");
  }

  async function copyAllCallbacks() {
    if (!diagnostics) return;
    setActionId("copy-all");
    const lines = (Object.entries(diagnostics.callbacks) as Array<[OAuthId, string]>).map(
      ([id, url]) => `${names[id]}: ${url}`,
    );
    await copyText(lines.join("\n"), "서비스별 콜백 주소를 모두 복사했습니다.");
    setActionId("");
  }

  return (
    <div className="connections-manager">
      <section className="connections-summary">
        <div className="metric-card"><span>핵심·외부 연결</span><strong>{totalCount || 8}</strong></div>
        <div className="metric-card"><span>준비 완료</span><strong>{connectedCount}</strong></div>
        <div className="metric-card"><span>남은 연결</span><strong>{Math.max(0, (totalCount || 8) - connectedCount)}</strong></div>
      </section>

      <section className="core-connections">
        <article><span>🧠</span><div><h2>OpenAI</h2><p>AI 비서·상품 분석·콘텐츠 생성</p></div><strong className={core.openai ? "done" : "missing"}>{core.openai ? "준비 완료" : "키 필요"}</strong></article>
        <article><span>🗄️</span><div><h2>Supabase</h2><p>데이터·회원·암호화 토큰 저장 기반</p></div><strong className={core.supabase ? "done" : "missing"}>{core.supabase ? "준비 완료" : "키 필요"}</strong></article>
      </section>

      {diagnostics && (
        <section className="connection-diagnostics">
          <div className="diagnostics-heading">
            <div><span>CONNECTION DOCTOR</span><h2>연동 자동 진단</h2><p>비밀값은 표시하지 않고 주소·키 준비 여부·토큰 저장 기반만 검사합니다.</p></div>
            <div className="diagnostics-actions">
              <button onClick={() => void copyAllCallbacks()} disabled={actionId === "copy-all"}>콜백 주소 모두 복사</button>
              <button className="secondary" onClick={() => void refresh()} disabled={actionId === "refresh"}>상태 다시 검사</button>
            </div>
          </div>
          <div className="diagnostics-checks">
            {diagnostics.checks.map((check) => (
              <article key={check.id} className={check.ok ? "ok" : "fail"}>
                <b>{check.ok ? "정상" : "확인 필요"}</b><strong>{check.label}</strong><p>{check.detail}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {message && <div className="connection-alert success">{message}</div>}
      {error && <div className="connection-alert error">{error}</div>}

      <section className="connections-grid">
        {loading ? (
          <article className="connection-card loading">주소와 계정 권한을 확인하고 있습니다...</article>
        ) : (
          connections.map((connection) => {
            const meta = metadata[connection.id];
            const isOAuth = oauthIds.has(connection.id);
            const callback = isOAuth && diagnostics
              ? diagnostics.callbacks[connection.id as OAuthId]
              : null;
            return (
              <article className="connection-card" key={connection.id}>
                <div className="connection-card-top">
                  <div className="connection-title-wrap"><span className="connection-icon">{meta.icon}</span><div><p>{meta.purpose}</p><h2>{connection.name}</h2></div></div>
                  <span className={`connection-badge ${connection.connected ? "connected" : connection.configured ? "ready" : "missing"}`}>{connection.connected ? "연결 완료" : connection.configured ? "승인·검증 필요" : "설정 필요"}</span>
                </div>
                {connection.account && <div className="connection-account">연결 대상: <strong>{connection.account}</strong></div>}
                <p className="connection-detail">{connection.detail}</p>
                <div className="connection-env-box"><strong>필요한 환경변수</strong>{meta.env.map((env) => <code key={env}>{env}</code>)}</div>
                {callback && (
                  <div className="connection-callback-box"><strong>외부 콘솔 콜백 주소</strong><code>{callback}</code><button onClick={() => void copyText(callback, `${connection.name} 콜백 주소를 복사했습니다.`)}>주소 복사</button></div>
                )}
                {connection.limitation && <p className="connection-limitation">{connection.limitation}</p>}
                <div className="connection-actions">
                  {isOAuth ? (
                    connection.connected ? (
                      <button disabled={actionId === connection.id} onClick={() => void disconnect(connection.id as OAuthId)}>연결 해제</button>
                    ) : (
                      <a className={!connection.configured ? "disabled" : ""} href={connection.configured ? meta.start : undefined}>계정 연결</a>
                    )
                  ) : (
                    <button disabled={!connection.configured || actionId === connection.id} onClick={() => void runTest(connection)}>{connection.connected ? "다시 테스트" : "연결 테스트"}</button>
                  )}
                  {connection.id === "temu" && <a className="secondary-action" href="/admin/products/new">상품별 링크 등록</a>}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
