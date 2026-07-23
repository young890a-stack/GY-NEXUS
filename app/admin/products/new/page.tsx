"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(form.entries());
      Object.assign(payload, { is_public: form.has("is_public"), is_featured: form.has("is_featured") });
      const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(data.message || "상품 등록에 실패했습니다.");
      router.push("/admin/products"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "상품 등록에 실패했습니다."); setLoading(false); }
  }

  return (<><div className="admin-top"><div><h1>새 상품 등록</h1><p>품질·공개 상태·쇼츠·제휴링크를 한 번에 관리합니다.</p></div><Link className="button button-light" href="/admin/products">← 목록으로</Link></div><div className="card form-card">{message && <div className="alert alert-error" style={{ marginBottom: 18 }}>{message}</div>}<form className="form-grid" onSubmit={handleSubmit}>
          <div className="field"><label htmlFor="title">상품명 *</label><input id="title" name="title" className="input" required defaultValue={""} /></div>
          <div className="field"><label htmlFor="description">상품 설명</label><textarea id="description" name="description" className="textarea" defaultValue={""} /></div>
          <div className="field"><label htmlFor="category">카테고리</label><select id="category" name="category" className="select" defaultValue={"etc"}><option value="life-cleaning">생활·청소</option><option value="digital-electronics">디지털·전자기기</option><option value="laptop-tablet">노트북·태블릿</option><option value="deals">할인·기획</option><option value="etc">기타</option></select></div>
          <div className="field"><label htmlFor="platform">판매 플랫폼</label><select id="platform" name="platform" className="select" defaultValue={"coupang"}><option value="coupang">쿠팡</option><option value="temu">테무</option><option value="naver">네이버</option><option value="etc">기타</option></select></div>
          <div className="field"><label htmlFor="price_text">가격 표시</label><input id="price_text" name="price_text" className="input" defaultValue={""} placeholder="예: 19,900원" /></div>
          <div className="field"><label htmlFor="quality_score">상품 품질점수</label><input id="quality_score" name="quality_score" className="input" type="number" min="0" max="100" defaultValue={0} /></div>
          <div className="field"><label htmlFor="image_url">대표 이미지 URL</label><input id="image_url" name="image_url" className="input" type="url" defaultValue={""} placeholder="https://..." /></div>
          <div className="field"><label htmlFor="affiliate_url">제휴 링크 *</label><input id="affiliate_url" name="affiliate_url" className="input" type="url" required defaultValue={""} placeholder="https://link.coupang.com/..." /></div>
          <div className="field"><label htmlFor="target_audience">추천 대상</label><textarea id="target_audience" name="target_audience" className="textarea" defaultValue={""} /></div>
          <div className="field"><label htmlFor="selling_points">핵심 장점</label><textarea id="selling_points" name="selling_points" className="textarea" defaultValue={""} placeholder="한 줄에 하나씩 입력" /></div>
          <div className="field"><label htmlFor="usage_tips">활용 팁</label><textarea id="usage_tips" name="usage_tips" className="textarea" defaultValue={""} /></div>
          <div className="field"><label htmlFor="cautions">확인할 점</label><textarea id="cautions" name="cautions" className="textarea" defaultValue={""} /></div>
          <div className="field"><label htmlFor="short_video_url">15초 쇼츠 URL</label><input id="short_video_url" name="short_video_url" className="input" type="url" defaultValue={""} /></div>
          <div className="field"><label htmlFor="long_video_url">상세 쇼츠 URL</label><input id="long_video_url" name="long_video_url" className="input" type="url" defaultValue={""} /></div>
          <div className="field"><label htmlFor="review_url">블로그 리뷰 URL</label><input id="review_url" name="review_url" className="input" type="url" defaultValue={""} /></div>
          <div className="field"><label htmlFor="status">운영 상태</label><select id="status" name="status" className="select" defaultValue={"draft"}><option value="draft">초안</option><option value="review">검토 대기</option><option value="published">공개</option><option value="paused">일시중지</option><option value="sold_out">품절</option><option value="link_error">링크 오류</option></select></div>
          <div className="field"><label htmlFor="link_status">링크 상태</label><select id="link_status" name="link_status" className="select" defaultValue={"unchecked"}><option value="unchecked">미확인</option><option value="healthy">정상</option><option value="broken">오류</option><option value="sold_out">품절</option></select></div>
          <label className="field"><span>공개 상품관 노출</span><input name="is_public" type="checkbox" defaultChecked={false} /> 공개 상태와 함께 체크해야 방문자에게 보입니다.</label>
          <label className="field"><span>대표 추천 상품</span><input name="is_featured" type="checkbox" defaultChecked={false} /> 목록 상단에 우선 노출합니다.</label>
          <button className="button button-primary" type="submit" disabled={loading}>{loading ? "등록 중..." : "상품 등록하기"}</button>
        </form></div></>);
}
