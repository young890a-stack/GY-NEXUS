"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body>
        <main style={{ maxWidth: 760, margin: "80px auto", padding: 24 }}>
          <h1>GY-NEXUS를 복구하고 있습니다.</h1>
          <p>일시적인 화면 오류입니다. 아래 버튼으로 다시 불러오세요.</p>
          <button type="button" onClick={reset}>다시 불러오기</button>
        </main>
      </body>
    </html>
  );
}
