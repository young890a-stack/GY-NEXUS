import Link from "next/link";

export default function AdminPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f6fa", padding: 40 }}>
      <h1 style={{ fontSize: 32, fontWeight: "bold" }}>GY Nexus Dashboard</h1>
      <p style={{ marginTop: 8, color: "#666" }}>
        AI 자동 제휴마케팅 관리자 시스템
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
          marginTop: 30,
        }}
      >
        <div style={cardStyle}>
          <p>📦 등록 상품</p>
          <h2>0개</h2>
        </div>

        <div style={cardStyle}>
          <p>🖱 총 클릭수</p>
          <h2>0회</h2>
        </div>

        <div style={cardStyle}>
          <p>🤖 생성 콘텐츠</p>
          <h2>0개</h2>
        </div>

        <div style={cardStyle}>
          <p>💰 예상 수익</p>
          <h2>₩0</h2>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
          marginTop: 30,
        }}
      >
        <Link href="/admin/products/new" style={buttonStyle}>
          📦 상품 등록
        </Link>

        <Link href="/admin/products" style={buttonStyle}>
          🛒 상품 관리
        </Link>

        <Link href="/admin/content" style={buttonStyle}>
          🤖 AI 콘텐츠
        </Link>

        <Link href="/admin/stats" style={buttonStyle}>
          📈 통계 보기
        </Link>
      </section>

      <section style={{ ...cardStyle, marginTop: 30 }}>
        <h2>최근 작업</h2>
        <p style={{ color: "#777", marginTop: 10 }}>
          아직 등록된 상품이 없습니다. 먼저 상품을 등록해보세요.
        </p>
      </section>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 16,
  boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
};

const buttonStyle: React.CSSProperties = {
  background: "black",
  color: "white",
  padding: 22,
  borderRadius: 16,
  textDecoration: "none",
  fontWeight: "bold",
  textAlign: "center",
};