"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ maxWidth: 760, margin: "80px auto", padding: 24 }}>
      <div className="panel">
        <span className="eyebrow">SAFE RECOVERY</span>
        <h1>화면 처리 중 문제가 발생했습니다.</h1>
        <p>{error.message || "알 수 없는 오류"}</p>
        <button className="button button-primary" type="button" onClick={reset}>다시 시도</button>
      </div>
    </main>
  );
}
