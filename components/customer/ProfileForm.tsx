"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const options = ["AI", "재테크", "부업", "IT", "쇼핑"];

export default function ProfileForm({ id, displayName, interests, role }: { id: string; displayName: string; interests: string[]; role: string }) {
  const [name, setName] = useState(displayName);
  const [selected, setSelected] = useState<string[]>(interests);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function toggle(value: string) {
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ display_name: name, interests: selected, updated_at: new Date().toISOString() }).eq("id", id);
    setMessage(error ? error.message : "프로필이 저장되었습니다.");
    setLoading(false);
  }

  return (
    <form className="panel form-grid member-form" onSubmit={submit}>
      <div><span className="eyebrow">GY PROFILE</span><h1>프로필 설정</h1><p>관심 분야를 선택하면 GY가 더 정확한 콘텐츠를 추천합니다.</p></div>
      <div className="field"><label htmlFor="displayName">표시 이름</label><input id="displayName" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <div className="field"><label>계정 유형</label><div className="role-badge">{role === "owner" ? "Owner" : "Member"}</div></div>
      <fieldset className="choice-field"><legend>관심 분야</legend><div className="interest-selector">{options.map((item) => <button key={item} type="button" className={selected.includes(item) ? "interest-chip selected" : "interest-chip"} onClick={() => toggle(item)}>{item}</button>)}</div></fieldset>
      <button className="button button-primary" disabled={loading}>{loading ? "저장 중..." : "프로필 저장"}</button>
      {message && <div className="notice">{message}</div>}
    </form>
  );
}
