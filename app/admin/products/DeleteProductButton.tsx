"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteProductButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm("정말 이 상품을 삭제할까요? 클릭 기록도 함께 삭제됩니다.")) return;
    setLoading(true);
    const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(data.message || data.error || "삭제에 실패했습니다.");
      setLoading(false);
      return;
    }
    router.push("/admin/products");
    router.refresh();
  }

  return <button type="button" className="button button-danger" onClick={handleDelete} disabled={loading}>{loading ? "삭제 중..." : "상품 삭제"}</button>;
}
