"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage("로그인 중...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("로그인 실패: " + error.message);
      return;
    }

    window.location.href = "/admin";
  }

  return (
    <main style={{ maxWidth: 420, margin: "100px auto", padding: 24 }}>
      <h1 style={{ fontSize: 32, fontWeight: "bold", marginBottom: 20 }}>
        GY Nexus 관리자 로그인
      </h1>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 12, marginBottom: 12 }}
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 12, marginBottom: 12 }}
        />

        <button
          type="submit"
          style={{
            width: "100%",
            padding: 14,
            background: "black",
            color: "white",
            borderRadius: 8,
          }}
        >
          로그인
        </button>
      </form>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </main>
  );
}