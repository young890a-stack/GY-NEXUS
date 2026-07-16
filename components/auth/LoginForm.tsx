"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const role = data.user?.user_metadata?.role;
    const destination = nextPath?.startsWith("/") ? nextPath : role === "admin" ? "/admin" : "/member";
    router.replace(destination);
    router.refresh();
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="form-group"><label htmlFor="email">이메일</label><input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div className="form-group"><label htmlFor="password">비밀번호</label><input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      <button className="button button-primary" disabled={loading} type="submit">{loading ? "로그인 중..." : "GY 로그인"}</button>
      {message && <div className="notice notice-error">{message}</div>}
    </form>
  );
}
