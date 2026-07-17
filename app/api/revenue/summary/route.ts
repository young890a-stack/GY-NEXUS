import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const demo={
 source:"demo" as const,
 totals:{revenue:2150000,views:1248560,clicks:159803,conversions:7351,ctr:12.8,conversionRate:4.6,publishSuccessRate:99.2},
 channels:[
  {name:"YouTube",revenue:950300,views:810400,clicks:105352,conversions:4132,color:"#4f46e5"},
  {name:"Blogger",revenue:604150,views:191220,clicks:25432,conversions:1321,color:"#7c3aed"},
  {name:"네이버 블로그",revenue:335400,views:149870,clicks:17834,conversions:905,color:"#10b981"},
  {name:"Coupang",revenue:146200,views:55100,clicks:6831,conversions:721,color:"#f97316"},
  {name:"Temu",revenue:75250,views:41970,clicks:4354,conversions:272,color:"#eab308"},
  {name:"기타",revenue:38700,views:0,clicks:0,conversions:0,color:"#94a3b8"}],
 trend:[{label:"07/01",revenue:152000,views:120000},{label:"07/04",revenue:178000,views:146000},{label:"07/07",revenue:194000,views:161000},{label:"07/10",revenue:181000,views:155000},{label:"07/13",revenue:226000,views:193000},{label:"07/15",revenue:239000,views:215000},{label:"07/17",revenue:268000,views:258000}],
 recommendations:[
 {title:"Galaxy Tab S10 FE 쇼츠 제작",reason:"최근 7일 태블릿 콘텐츠의 CTR과 전환율이 동시에 상승했습니다.",score:98,channel:"YouTube",publishAt:"오늘 19:00",predictedCtr:17.2,predictedRevenue:82400},
 {title:"AI 브라우저 정보형 블로그",reason:"검색 유입 성장률과 기존 독자 관심사의 적합도가 높습니다.",score:92,channel:"Blogger",publishAt:"내일 14:30",predictedCtr:12.9,predictedRevenue:45000},
 {title:"USB-C 허브 사용 장면 영상",reason:"구매 전환은 양호하며 차별화된 실제 사용 장면이 필요합니다.",score:85,channel:"YouTube",publishAt:"오늘 20:30",predictedCtr:11.6,predictedRevenue:31800}],
 forecast:{revenue:2680000,views:1510000,ctr:13.4,confidence:82},
 recent:[
 {title:"Galaxy Tab S10 FE 1주일 사용 후기",channel:"YouTube",views:52340,ctr:16.3,revenue:82400,status:"성공"},
 {title:"AI 브라우저 완벽 가이드 (2026)",channel:"Blogger",views:8540,ctr:9.8,revenue:32100,status:"성공"},
 {title:"직장인을 위한 AI 자동화 도구 TOP 5",channel:"네이버",views:6210,ctr:7.5,revenue:18600,status:"예약"}]
};
export async function GET(req:NextRequest){
 try{
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY)) return NextResponse.json(demo);
  const supabase=createAdminClient();
  const days=req.nextUrl.searchParams.get("period")==="7d"?7:req.nextUrl.searchParams.get("period")==="90d"?90:30;
  const since=new Date(Date.now()-days*86400000).toISOString();
  const {data,error}=await supabase.from("revenue_events").select("*").gte("occurred_at",since).order("occurred_at");
  if(error || !data?.length) return NextResponse.json(demo);
  const channelMap=new Map<string,{name:string;revenue:number;views:number;clicks:number;conversions:number;color:string}>();
  for(const e of data){const name=e.channel||"기타"; const c=channelMap.get(name)||{name,revenue:0,views:0,clicks:0,conversions:0,color:"#6366f1"}; c.revenue+=Number(e.revenue||0);c.views+=Number(e.views||0);c.clicks+=Number(e.clicks||0);c.conversions+=Number(e.conversions||0);channelMap.set(name,c)}
  const channels=[...channelMap.values()]; const totals=channels.reduce((a,c)=>({revenue:a.revenue+c.revenue,views:a.views+c.views,clicks:a.clicks+c.clicks,conversions:a.conversions+c.conversions}),{revenue:0,views:0,clicks:0,conversions:0});
  return NextResponse.json({...demo,source:"database",totals:{...demo.totals,...totals,ctr:totals.views?totals.clicks/totals.views*100:0,conversionRate:totals.clicks?totals.conversions/totals.clicks*100:0},channels});
 }catch{return NextResponse.json(demo)}
}
