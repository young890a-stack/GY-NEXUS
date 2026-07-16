"use client";
import { useState } from "react";
export default function ContentHistoryActions({ title, content }: { title: string; content: string }) {
  const [copied,setCopied]=useState(false);
  async function copy(){await navigator.clipboard.writeText(content);setCopied(true);setTimeout(()=>setCopied(false),1800)}
  function download(){const blob=new Blob([content],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${title.replace(/[\\/:*?"<>|]/g,"-")}.txt`;a.click();URL.revokeObjectURL(url)}
  return <div className="actions" style={{marginTop:0}}><button className="button button-light" onClick={copy}>{copied?"✅ 복사됨":"📋 전체 복사"}</button><button className="button button-primary" onClick={download}>⬇️ 파일 저장</button></div>
}
