import Link from "next/link";
import { getEnvironmentStatus, getReadinessSummary } from "@/lib/env-validation";

const groupNames = { core: "핵심 인프라", ai: "AI 엔진", publish: "게시 채널", creative: "크리에이티브", optional: "선택 연동" } as const;

export const dynamic = "force-dynamic";

export default function SystemStatusPage() {
  const items = getEnvironmentStatus();
  const summary = getReadinessSummary();

  return (
    <section className="section system-status-page">
      <div className="admin-top">
        <div>
          <span className="eyebrow">RELEASE v2.0</span>
          <h1>운영 상태 모니터링</h1>
          <p>비밀 키 값은 표시하지 않고 연결 여부만 안전하게 검사합니다.</p>
        </div>
        <span className={`release-status ${summary.ready ? "is-ready" : "needs-config"}`}>
          {summary.ready ? "CORE READY" : "SETUP REQUIRED"}
        </span>
      </div>

      <div className="grid grid-4 status-summary-grid">
        <article className="panel stat-card"><p>제품 버전</p><strong>v2.0.0</strong></article>
        <article className="panel stat-card"><p>연결 완료</p><strong>{summary.configuredCount}/{summary.totalCount}</strong></article>
        <article className="panel stat-card"><p>핵심 준비 상태</p><strong>{summary.ready ? "정상" : "확인 필요"}</strong></article>
        <article className="panel stat-card"><p>Health API</p><strong>/api/system/health</strong></article>
      </div>

      <div className="status-groups">
        {Object.entries(groupNames).map(([group, name]) => (
          <article className="panel status-group" key={group}>
            <div className="section-head"><div><h2>{name}</h2><p>환경변수 연결 상태</p></div></div>
            <div className="status-list">
              {items.filter((item) => item.group === group).map((item) => (
                <div className="status-row" key={item.key}>
                  <span className={`status-indicator ${item.configured ? "connected" : "disconnected"}`} aria-hidden="true" />
                  <div><strong>{item.label}</strong><small>{item.key}{item.required ? " · 필수" : " · 선택"}</small></div>
                  <b>{item.configured ? "연결됨" : "미연결"}</b>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="panel release-actions">
        <div><h2>출시 전 마지막 확인</h2><p>연결센터에서 키를 등록한 뒤 최종 검증 명령을 실행하세요.</p></div>
        <div className="actions"><Link className="button button-primary" href="/admin/connections">통합 연결센터</Link><Link className="button button-light" href="/admin">CEO Dashboard</Link></div>
      </div>
    </section>
  );
}
