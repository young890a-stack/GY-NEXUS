"use client";

import { FormEvent, useEffect, useState } from "react";

type Schedule = {
  id: string;
  title: string;
  channel: string;
  scheduled_at: string;
  status: string;
};

export default function SchedulesPage() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("naver_blog");
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState("");

  async function loadSchedules() {
    const response = await fetch("/api/schedules", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "예약 목록을 불러오지 못했습니다.");
    }

    setItems(data.items ?? []);
  }

  useEffect(() => {
    let active = true;

    fetch("/api/schedules", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "예약 목록을 불러오지 못했습니다.");
        }
        return data;
      })
      .then((data) => {
        if (active) setItems(data.items ?? []);
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "예약 목록을 불러오지 못했습니다."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, channel, scheduledAt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "예약 저장에 실패했습니다.");
      }

      setMessage("예약이 저장됐습니다.");
      setTitle("");
      setScheduledAt("");
      await loadSchedules();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "예약 저장에 실패했습니다."
      );
    }
  }

  return (
    <>
      <div className="admin-top">
        <div>
          <h1>예약 생성</h1>
          <p>콘텐츠 제작과 발행 예정 일정을 관리합니다.</p>
        </div>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "minmax(300px,.8fr) minmax(0,1.2fr)",
          alignItems: "start",
        }}
      >
        <form className="panel form-grid" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="schedule-title">예약 제목</label>
            <input
              id="schedule-title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="schedule-channel">채널</label>
            <select
              id="schedule-channel"
              className="select"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="naver_blog">네이버 블로그</option>
              <option value="youtube_shorts">유튜브 쇼츠</option>
              <option value="instagram">인스타그램</option>
              <option value="google_blog">구글 블로그</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="schedule-datetime">예약 일시</label>
            <input
              id="schedule-datetime"
              className="input"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              required
            />
          </div>

          <button type="submit" className="button button-primary">
            예약 저장
          </button>

          {message && <div className="notice">{message}</div>}
        </form>

        <section className="panel">
          <h2>예약 목록</h2>

          {items.length ? (
            items.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <b>{item.title}</b>
                <div style={{ color: "var(--muted)" }}>
                  {item.channel} ·{" "}
                  {new Date(item.scheduled_at).toLocaleString("ko-KR")} ·{" "}
                  {item.status}
                </div>
              </div>
            ))
          ) : (
            <div className="empty">예약이 없습니다.</div>
          )}
        </section>
      </div>
    </>
  );
}
