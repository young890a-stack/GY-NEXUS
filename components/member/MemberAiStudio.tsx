"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type MemberAccess = {
  planKey: "free" | "plus" | "pro";
  planName: string;
  monthlyLimit: number;
  used: number;
  remaining: number;
  setupRequired: boolean;
};

type Ideas = { titles: string[]; angle: string; caution: string };

export default function MemberAiStudio() {
  const [access, setAccess] = useState<MemberAccess | null>(null);
  const [ideas, setIdeas] = useState<Ideas | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/member/access", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "요금제 정보를 불러오지 못했습니다.");
        setAccess(data as MemberAccess);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "요금제 정보를 불러오지 못했습니다."));
  }, []);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIdeas(null);

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/member/ai/title-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: form.get("topic"), audience: form.get("audience") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "AI 실행에 실패했습니다.");
      setIdeas(data.ideas as Ideas);
      setAccess((current) => current ? { ...current, ...data.access } : current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 실행에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel member-ai-studio">
      <div className="member-ai-heading">
        <div>
          <span className="eyebrow">MY GY AI</span>
          <h2>콘텐츠 제목 아이디어</h2>
          <p>주제와 독자를 알려주면 과장 없이 활용 가능한 제목을 제안합니다.</p>
        </div>
        <div className="member-plan-meter">
          <strong>{access?.planName || "확인 중"}</strong>
          <span>{access ? `${access.remaining} / ${access.monthlyLimit}회 남음` : "사용량 확인 중"}</span>
        </div>
      </div>

      {access?.setupRequired && <div className="member-setup-note">대표 설정이 끝나면 월 {access.monthlyLimit}회 무료 AI가 활성화됩니다.</div>}
      {message && <div className="alert alert-error">{message}</div>}

      <form className="member-ai-form" onSubmit={generate}>
        <label>
          만들고 싶은 주제
          <input className="input" name="topic" required minLength={2} maxLength={200} placeholder="예: 직장인을 위한 생성형 AI 업무 활용법" />
        </label>
        <label>
          주요 독자
          <input className="input" name="audience" maxLength={100} placeholder="예: AI를 처음 쓰는 30대 직장인" />
        </label>
        <button className="button button-primary" type="submit" disabled={loading || access?.setupRequired || access?.remaining === 0}>
          {loading ? "Dream Y가 기획 중..." : "제목 7개 만들기"}
        </button>
      </form>

      {ideas && (
        <div className="member-ai-result">
          <div><b>추천 방향</b><p>{ideas.angle}</p></div>
          <ol>{ideas.titles.map((title) => <li key={title}>{title}</li>)}</ol>
          <small>검토 메모: {ideas.caution}</small>
        </div>
      )}

      <div className="member-ai-locks">
        <article><b>콘텐츠 개요</b><span>GY Plus 준비 중</span></article>
        <article><b>쇼츠 대본</b><span>GY Plus 준비 중</span></article>
        <article><b>SEO 패키지</b><span>GY Pro 준비 중</span></article>
        <Link href="/pricing">요금제 설계 보기 →</Link>
      </div>
    </section>
  );
}
