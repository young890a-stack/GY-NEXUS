"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Connection = { id: string; name: string; connected: boolean; configured: boolean; detail: string };
export default function SetupWizard() {
  const [items, setItems] = useState<Connection[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/connections/status", { cache: "no-store" }).then((r) => r.json()).then((d) => setItems(d.connections || [])).finally(() => setLoading(false)); }, []);
  const complete = useMemo(() => items.filter((i) => i.connected).length, [items]);
  return <div className="setup-wizard"><div className="setup-progress"><strong>{loading ? "확인 중" : `${complete}/${items.length} 연결 완료`}</strong><div><span style={{ width: items.length ? `${(complete / items.length) * 100}%` : "0%" }} /></div></div>
    <div className="setup-steps">{items.map((item, index) => <article key={item.id}><span>{index + 1}</span><div><h2>{item.name}</h2><p>{item.detail}</p></div><strong className={item.connected ? "done" : item.configured ? "ready" : "missing"}>{item.connected ? "완료" : item.configured ? "연결하기" : "키 입력"}</strong></article>)}</div>
    <div className="setup-next"><Link href="/admin/connections">통합 연결센터 열기</Link><Link href="/admin/assistant">AI 운영 비서 시작</Link></div>
  </div>;
}
