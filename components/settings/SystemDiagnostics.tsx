"use client";

import { useState } from "react";

type Service = {
  key: string;
  label: string;
  group: "core" | "ai" | "publish" | "creative" | "optional";
  required: boolean;
  configured: boolean;
};

type Result = {
  status: "operational" | "configuration_required";
  timestamp: string;
  summary: {
    ready: boolean;
    configuredCount: number;
    totalCount: number;
    requiredMissing: string[];
  };
  services: Service[];
};

const groupNames: Record<Service["group"], string> = {
  core: "핵심",
  ai: "AI",
  publish: "게시",
  creative: "제작",
  optional: "선택",
};

function isHealthResult(value: unknown): value is Result {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Result>;
  return Boolean(
    candidate.summary &&
      Array.isArray(candidate.summary.requiredMissing) &&
      Array.isArray(candidate.services),
  );
}

export default function SystemDiagnostics() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system/health", { cache: "no-store" });
      const data: unknown = await response.json();
      if (!isHealthResult(data)) {
        throw new Error("진단 서버의 응답 형식이 올바르지 않습니다.");
      }
      setResult(data);
      if (!response.ok || !data.summary.ready) {
        setError("필수 환경변수 일부가 비어 있습니다. 아래 ‘필수’ 항목을 확인하세요.");
      }
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : "진단을 실행하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 20 }} suppressHydrationWarning>
      <h2>원클릭 환경 진단</h2>
      <p className="help">비밀값은 표시하지 않고 필수·선택 환경변수가 준비됐는지만 검사합니다.</p>
      <button className="button button-primary" type="button" onClick={run} disabled={loading}>
        {loading ? "진단 중..." : "전체 환경변수 진단 실행"}
      </button>
      {error && <div className="alert alert-warning" style={{ marginTop: 16 }}>{error}</div>}
      {result && (
        <>
          <div className={`alert ${result.summary.ready ? "alert-success" : "alert-warning"}`} style={{ marginTop: 16 }}>
            {result.summary.ready ? "필수 운영 환경이 준비되었습니다." : `필수 누락: ${result.summary.requiredMissing.join(", ") || "없음"}`}
            {` · 전체 ${result.summary.configuredCount}/${result.summary.totalCount}개 설정`}
          </div>
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            {result.services.map((service) => (
              <div className="mini-stat" key={service.key}>
                <b>{service.configured ? "✅" : "⚪"} {service.label}</b>
                <p>{groupNames[service.group]} · {service.required ? "필수" : "선택"} · {service.configured ? "입력됨" : "미입력"}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
