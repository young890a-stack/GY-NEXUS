"use client";
import { useState } from "react";
export default function JsonImportBox({type}:{type:"trends"|"revenue"}){
 const [text,setText]=useState(type==="trends"?'[{"title":"상품명","affiliate_url":"https://...","platform":"coupang","external_rank":1}]':'[{"platform":"coupang","order_id":"ORDER-001","amount":29900,"commission":897,"occurred_at":"2026-07-11T00:00:00Z"}]');
 const [message,setMessage]=useState("");
 async function submit(){try{const items=JSON.parse(text);const res=await fetch(`/api/import/${type}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items})});const data=await res.json();setMessage(data.success?`${data.count}건 저장 완료`:data.message);}catch{setMessage("JSON 형식을 확인해주세요.");}}
 return <div className="panel form-grid"><textarea className="textarea" style={{minHeight:260}} value={text} onChange={(e)=>setText(e.target.value)}/><button className="button button-primary" onClick={submit}>데이터 가져오기</button>{message&&<div className="notice notice-success">{message}</div>}</div>;
}
