"use client";

import { useRouter } from "next/navigation";

export default function DeleteProductButton({ id }: { id: string }) {
  const router = useRouter();

  async function handleDelete() {
    const ok = confirm("정말 이 상품을 삭제할까요?");

    if (!ok) return;

    const res = await fetch(`/api/products/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      alert("삭제되었습니다.");
      router.refresh();
    } else {
      alert("삭제에 실패했습니다.");
    }
  }

  return (
    <button
      onClick={handleDelete}
      style={{
        padding: "8px 12px",
        border: "1px solid #ef4444",
        borderRadius: "8px",
        background: "white",
        color: "#ef4444",
        cursor: "pointer",
      }}
    >
      삭제
    </button>
  );
}