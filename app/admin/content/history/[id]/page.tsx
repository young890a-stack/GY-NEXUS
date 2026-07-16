import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ContentHistoryActions from "@/components/ContentHistoryActions";
export const dynamic="force-dynamic";
type Item={id:string;product_title:string;content_type:"blog"|"shorts"|"package";title:string;content:string;created_at:string};
export default async function Detail({params}:{params:Promise<{id:string}>}){const {id}=await params;const s=await createClient();const r=await s.from("ai_contents").select("id,product_title,content_type,title,content,created_at").eq("id",id).single();if(r.error||!r.data)notFound();const i=r.data as Item;return <><div className="admin-top"><div><h1>{i.title}</h1><p>{i.product_title} · {new Date(i.created_at).toLocaleString("ko-KR")}</p></div><Link className="button button-light" href="/admin/content/history">← 생성 이력</Link></div><section className="panel"><div className="section-head"><div><h2>생성 결과</h2><p>{i.content_type}</p></div><ContentHistoryActions title={i.title} content={i.content}/></div><pre className="ai-output" style={{background:"#fbfcff",color:"var(--text)",border:"1px solid var(--line)",maxHeight:"none"}}>{i.content}</pre></section></>}
