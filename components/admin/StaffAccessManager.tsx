"use client";

import { useEffect, useState } from "react";

type Role = "owner" | "admin" | "editor" | "viewer";
type StaffUser = { id: string; email: string; role: Role | null; createdAt: string; lastSignInAt: string | null };
const roleLabels: Record<Role, string> = { owner: "대표", admin: "관리자", editor: "제작 담당", viewer: "조회 전용" };

export default function StaffAccessManager() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/staff", { cache: "no-store" });
      const data = await response.json() as { users?: StaffUser[]; error?: string };
      if (!response.ok || !data.users) throw new Error(data.error || "사용자 목록을 불러오지 못했습니다.");
      setUsers(data.users);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "사용자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function changeRole(user: StaffUser, role: Role | null) {
    setSaving(user.id);
    setError("");
    try {
      const response = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "권한을 저장하지 못했습니다.");
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, role } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "권한을 저장하지 못했습니다.");
    } finally {
      setSaving("");
    }
  }

  if (loading) return <div className="panel"><p>회원과 직원 계정을 불러오는 중입니다...</p></div>;
  return (
    <div className="panel">
      <div className="section-head">
        <div><h2>계정별 역할</h2><p>역할을 지정하지 않은 계정은 고객 회원으로 유지됩니다.</p></div>
        <button className="button button-light" type="button" onClick={() => void load()}>새로고침</button>
      </div>
      {error && <div className="alert alert-warning" style={{ marginBottom: 16 }}>{error}</div>}
      <div className="status-list">
        {users.map((user) => (
          <div className="status-row" key={user.id}>
            <div>
              <strong>{user.email || "이메일 없는 계정"}</strong>
              <small>최근 로그인 {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString("ko-KR") : "기록 없음"}</small>
            </div>
            {user.role === "owner" ? <b>{roleLabels.owner}</b> : (
              <select
                aria-label={`${user.email} 역할`}
                value={user.role ?? ""}
                disabled={saving === user.id}
                onChange={(event) => void changeRole(user, (event.target.value || null) as Role | null)}
              >
                <option value="">고객 회원</option><option value="admin">관리자</option>
                <option value="editor">제작 담당</option><option value="viewer">조회 전용</option>
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

