"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const interestOptions = ["AI", "재테크", "부업", "IT", "쇼핑"];

export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"member" | "creator">("member");
  const [interests, setInterests] = useState<string[]>(["AI"]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function toggleInterest(value: string) {
    setInterests((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo, data: { display_name: name, role, interests } },
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
      <div className="field"><label htmlFor="email">이메일</label><input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div className="field"><label htmlFor="password">비밀번호</label><input id="password" className="input" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required /><small className="help">8자 이상으로 설정하세요.</small></div>
      <fieldset className="choice-field"><legend>계정 유형</legend><label><input type="radio" checked={role === "member"} onChange={() => setRole("member")} /> 일반 회원</label><label><input type="radio" checked={role === "creator"} onChange={() => setRole("creator")} /> Creator</label></fieldset>
      <fieldset className="choice-field"><legend>관심 분야</legend><div className="interest-selector">{interestOptions.map((item) => <button key={item} type="button" className={interests.includes(item) ? "interest-chip selected" : "interest-chip"} onClick={() => toggleInterest(item)}>{item}</button>)}</div></fieldset>
      <button className="button button-primary" disabled={loading}>{loading ? "가입 중..." : "GY 회원가입"}</button>
      {message && <div className="alert alert-warning">{message}</div>}
    </form>
  );
}
