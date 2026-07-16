"use client";
import { useEffect, useState } from "react";

type Job = { id:string; job_type:string; title:string; status:string; provider:string; asset_url?:string|null; error_message?:string|null; created_at:string };

export default function CreativeStudio() {
  const [title,setTitle]=useState("GY-NEXUS 상품 캠페인");
  const [imagePrompt,setImagePrompt]=useState("세련된 프리미엄 상품 광고 이미지, 깨끗한 스튜디오 조명, 제품 중심 구도, 네이비와 퍼플 미래형 배경, 20~40대가 신뢰할 수 있는 분위기, 한글 문구 없음");
  const [videoPrompt,setVideoPrompt]=useState("세로형 9:16 광고 영상. 첫 2초는 영화 같은 빠른 클로즈업, 제품의 핵심 장점을 자연스럽게 시연하고 부드러운 카메라 움직임, 과장 없는 현실적인 장면, 마지막은 구매를 강요하지 않는 깔끔한 마무리.");
  const [sourceImageUrl,setSourceImageUrl]=useState("");
  const [imageUrl,setImageUrl]=useState("");
  const [videoUrl,setVideoUrl]=useState("");
  const [loading,setLoading]=useState<"image"|"video"|null>(null);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [jobs,setJobs]=useState<Job[]>([]);

  async function refreshJobs(){ try { const r=await fetch("/api/creative-studio/jobs",{cache:"no-store"}); const d=await r.json(); if(d.success)setJobs(d.jobs); } catch {} }
  useEffect(()=>{refreshJobs()},[]);

  async function generateImage(){
    setLoading("image");setError("");setMessage("");
    try { const r=await fetch("/api/creative-studio/image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,prompt:imagePrompt,kind:"thumbnail",size:"1024x1536"})}); const d=await r.json(); if(!r.ok||!d.success)throw new Error(d.message); setImageUrl(d.result.assetUrl);setSourceImageUrl(d.result.assetUrl);setMessage("이미지 생성과 저장이 완료되었습니다."); await refreshJobs(); }
    catch(e){setError(e instanceof Error?e.message:"이미지 생성 실패");}finally{setLoading(null)}
  }
  async function generateVideo(){
    setLoading("video");setError("");setMessage("");
    try { const r=await fetch("/api/creative-studio/video",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,prompt:videoPrompt,sourceImageUrl:sourceImageUrl||undefined,duration:5,ratio:"720:1280"})}); const d=await r.json(); if(!r.ok||!d.success)throw new Error(d.message); setVideoUrl(d.result.assetUrl);setMessage("영상 생성과 저장이 완료되었습니다."); await refreshJobs(); }
    catch(e){setError(e instanceof Error?e.message:"영상 생성 실패");}finally{setLoading(null)}
  }

  return <div>
    <section className="panel" style={{padding:22}}>
      <div className="eyebrow">SPRINT 4 · CREATIVE STUDIO</div><h1 style={{marginBottom:8}}>AI 이미지·쇼츠 영상 제작실</h1>
      <p style={{marginTop:0}}>OpenAI 이미지 API와 Runway 영상 API를 연결해 실제 이미지와 세로형 영상 파일을 생성하고 Supabase Storage에 보관합니다.</p>
      <label>작업명<input value={title} onChange={e=>setTitle(e.target.value)} style={{width:"100%",marginTop:6}}/></label>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:16,marginTop:16}}>
        <div className="panel" style={{padding:16}}><h2>🎨 이미지 생성</h2><textarea value={imagePrompt} onChange={e=>setImagePrompt(e.target.value)} rows={8} style={{width:"100%"}}/><button className="button button-primary" onClick={generateImage} disabled={!!loading} style={{marginTop:10}}>{loading==="image"?"이미지 제작 중...":"세로형 이미지 생성"}</button>{imageUrl&&<div style={{marginTop:14}}><img src={imageUrl} alt="생성 이미지" style={{width:"100%",maxHeight:560,objectFit:"contain",borderRadius:12}}/><a className="button button-light" href={imageUrl} target="_blank" rel="noreferrer">원본 열기</a></div>}</div>
        <div className="panel" style={{padding:16}}><h2>🎬 쇼츠 영상 생성</h2><label>첫 장면 이미지 URL<input value={sourceImageUrl} onChange={e=>setSourceImageUrl(e.target.value)} placeholder="비워두면 텍스트→영상" style={{width:"100%",marginTop:6}}/></label><textarea value={videoPrompt} onChange={e=>setVideoPrompt(e.target.value)} rows={8} style={{width:"100%",marginTop:10}}/><button className="button button-primary" onClick={generateVideo} disabled={!!loading} style={{marginTop:10}}>{loading==="video"?"영상 제작 중(수 분 소요)...":"5초 세로 영상 생성"}</button>{videoUrl&&<div style={{marginTop:14}}><video src={videoUrl} controls playsInline style={{width:"100%",maxHeight:560,borderRadius:12}}/><a className="button button-light" href={videoUrl} target="_blank" rel="noreferrer">영상 원본 열기</a></div>}</div>
      </div>
      {message&&<p style={{color:"#15803d"}}>{message}</p>}{error&&<p style={{color:"#b91c1c"}}>{error}</p>}
    </section>
    <section className="panel" style={{padding:20,marginTop:16}}><h2>📁 최근 제작 이력</h2><div style={{overflowX:"auto"}}><table style={{width:"100%"}}><thead><tr><th>종류</th><th>작업명</th><th>상태</th><th>제공자</th><th>결과</th></tr></thead><tbody>{jobs.map(j=><tr key={j.id}><td>{j.job_type}</td><td>{j.title}</td><td>{j.status}</td><td>{j.provider}</td><td>{j.asset_url?<a href={j.asset_url} target="_blank" rel="noreferrer">열기</a>:j.error_message||"-"}</td></tr>)}</tbody></table></div></section>
  </div>
}
