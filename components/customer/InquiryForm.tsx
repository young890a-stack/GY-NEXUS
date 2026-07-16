"use client";

import { FormEvent, useState } from "react";

export default function InquiryForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/customer/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, subject, body }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(result.error || "문의를 등록하지 못했습니다.");
    else {
      setMessage("문의가 접수되었습니다. GY가 확인 후 안내드리겠습니다.");
      setSubject("");
      setBody("");
    }
    setLoading(false);
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="field"><label htmlFor="inquiryEmail">답변받을 이메일</label><input id="inquiryEmail" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div className="field"><label htmlFor="inquirySubject">문의 제목</label><input id="inquirySubject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required /></div>
      <div className="field"><label htmlFor="inquiryBody">문의 내용</label><textarea id="inquiryBody" className="input textarea" value={body} onChange={(e) => setBody(e.target.value)} minLength={5} maxLength={4000} required /></div>
      <button className="button button-primary" disabled={loading}>{loading ? "접수 중..." : "문의 접수"}</button>
      {message && <div className="notice">{message}</div>}
    </form>
  );
}
