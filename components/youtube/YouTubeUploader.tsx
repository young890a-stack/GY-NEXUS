"use client";
import { FormEvent, useState } from "react";
export default function YouTubeUploader() {
  const [loading,setLoading]=useState(false); const [message,setMessage]=useState(""); const [url,setUrl]=useState("");
  async function submit(event: FormEvent<HTMLFormElement>){event.preventDefault();setLoading(true);setMessage("");setUrl("");try{const response=await fetch("/api/youtube/upload",{method:"POST",body:new FormData(event.currentTarget)});const data=await response.json();if(!data.success)throw new Error(data.message||"업로드 실패");setMessage("YouTube 업로드가 완료되었습니다.");setUrl(data.url);}catch(error){setMessage(error instanceof Error?error.message:"업로드 실패");}finally{setLoading(false);}}
  return <form className="panel form-grid" onSubmit={submit}>
    <div className="form-group"><label>MP4 영상 파일</label><input className="input" type="file" name="video" accept="video/mp4,video/quicktime,video/webm" required /></div>
    <div className="form-group"><label>영상 제목</label><input className="input" name="title" maxLength={100} required placeholder="조회수를 고려한 제목을 입력하세요" /></div>
    <div className="form-group"><label>영상 설명</label><textarea className="textarea" name="description" rows={8} placeholder="광고 고지, 상품 설명, 제휴 링크를 입력하세요" /></div>
    <div className="form-group"><label>공개 상태</label><select className="select" name="privacyStatus" defaultValue="private"><option value="private">비공개 — 먼저 검토</option><option value="unlisted">일부 공개</option><option value="public">공개</option></select></div>
    <button className="button button-primary" disabled={loading}>{loading?"YouTube 업로드 중...":"▶ YouTube에 실제 업로드"}</button>
    {message&&<div className={url?"notice notice-success":"notice notice-error"}>{message}{url&&<> · <a href={url} target="_blank" rel="noreferrer">영상 열기</a></>}</div>}
  </form>;
}
