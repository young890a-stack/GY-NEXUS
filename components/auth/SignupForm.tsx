"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name, role: "member" } },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setMessage("가입 확인 메일을 보냈습니다. 메일 인증 후 로그인해 주세요.");
      setLoading(false);
      return;
    }
    router.replace("/member");
    router.refresh();
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="field"><label htmlFor="name">이름</label><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <div className="field"><label htmlFor="email">이메일</label><input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div className="field"><label htmlFor="password">비밀번호</label><input id="password" className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /><small className="help">8자 이상을 권장합니다.</small></div>
      <button className="button button-primary" disabled={loading}>{loading ? "가입 중..." : "GY 회원가입"}</button>
      {message && <div className="alert alert-warning">{message}</div>}
    </form>
  );
}
