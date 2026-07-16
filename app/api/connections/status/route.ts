import { NextRequest, NextResponse } from "next/server";
import { CONNECTION_COOKIE_OPTIONS, decryptConnectionValue, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { ConnectionState, OAuthToken } from "@/lib/connections/types";

type StateResult = { state: ConnectionState; refreshedToken?: OAuthToken };

async function refreshGoogleToken(token: OAuthToken, clientId?: string, clientSecret?: string): Promise<OAuthToken | null> {
  if (!clientId || !clientSecret || !token.refresh_token) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: token.refresh_token, grant_type: "refresh_token" }), cache: "no-store" });
  if (!response.ok) return null;
  const refreshed = (await response.json()) as Partial<OAuthToken>;
  if (!refreshed.access_token) return null;
  return { ...token, ...refreshed, refresh_token: token.refresh_token, created_at: Date.now() };
}

async function youtubeState(request: NextRequest): Promise<StateResult> {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim(); const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
  const configured = Boolean(clientId && clientSecret); let token = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_youtube_token")?.value);
  if (!configured) return { state: { id: "youtube", name: "YouTube", configured: false, connected: false, detail: "Google OAuth 클라이언트 설정이 필요합니다." } };
  if (!token?.access_token) return { state: { id: "youtube", name: "YouTube", configured: true, connected: false, detail: "Google 계정 연결 버튼을 눌러 채널 권한을 승인하세요." } };
  try {
    let response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" }); let refreshedToken;
    if (response.status === 401) { const refreshed = await refreshGoogleToken(token, clientId, clientSecret); if (refreshed) { token = refreshed; refreshedToken = refreshed; response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" }); } }
    const data = await response.json();
    if (!response.ok || !data.items?.length) return { state: { id: "youtube", name: "YouTube", configured: true, connected: false, detail: data.error?.message || "채널 정보를 확인할 수 없습니다." } };
    return { state: { id: "youtube", name: "YouTube", configured: true, connected: true, detail: "채널 조회와 영상 업로드 권한이 승인되었습니다.", account: data.items[0]?.snippet?.title || "YouTube 채널" }, refreshedToken };
  } catch { return { state: { id: "youtube", name: "YouTube", configured: true, connected: false, detail: "YouTube 연결 확인 중 네트워크 오류가 발생했습니다." } }; }
}

async function bloggerState(request: NextRequest): Promise<StateResult> {
  const clientId = (process.env.BLOGGER_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID)?.trim(); const clientSecret = (process.env.BLOGGER_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET)?.trim();
  const configured = Boolean(clientId && clientSecret); let token = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_blogger_token")?.value);
  if (!configured) return { state: { id: "blogger", name: "Google Blogger", configured: false, connected: false, detail: "Blogger API용 Google OAuth 설정이 필요합니다." } };
  if (!token?.access_token) return { state: { id: "blogger", name: "Google Blogger", configured: true, connected: false, detail: "Google 계정을 연결해 블로그 목록과 게시 권한을 승인하세요." } };
  try {
    let response = await fetch("https://www.googleapis.com/blogger/v3/users/self/blogs", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" }); let refreshedToken;
    if (response.status === 401) { const refreshed = await refreshGoogleToken(token, clientId, clientSecret); if (refreshed) { token = refreshed; refreshedToken = refreshed; response = await fetch("https://www.googleapis.com/blogger/v3/users/self/blogs", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" }); } }
    const data = await response.json();
    if (!response.ok) return { state: { id: "blogger", name: "Google Blogger", configured: true, connected: false, detail: data.error?.message || "Blogger API를 확인할 수 없습니다." } };
    const blogs = data.items || []; const preferred = process.env.BLOGGER_BLOG_ID?.trim(); const selected = blogs.find((b: { id?: string }) => b.id === preferred) || blogs[0];
    return { state: { id: "blogger", name: "Google Blogger", configured: true, connected: true, detail: blogs.length ? `${blogs.length}개 블로그 접근 권한이 승인되었습니다.` : "계정은 연결됐지만 Blogger 블로그가 없습니다.", account: selected?.name || selected?.url || "Google 계정", limitation: blogs.length ? `게시 대상 Blog ID: ${selected?.id}` : "Blogger에서 블로그를 먼저 생성하세요." }, refreshedToken };
  } catch { return { state: { id: "blogger", name: "Google Blogger", configured: true, connected: false, detail: "Blogger 연결 확인 중 네트워크 오류가 발생했습니다." } }; }
}

async function naverState(request: NextRequest): Promise<StateResult> {
  const configured = Boolean(process.env.NAVER_CLIENT_ID?.trim() && process.env.NAVER_CLIENT_SECRET?.trim());
  const token = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_naver_token")?.value);
  const limitation = "네이버 블로그 글쓰기는 공식 공개 API 제약으로 검수된 콘텐츠 복사·수동 발행 흐름을 사용합니다.";
  if (!configured) return { state: { id: "naver", name: "Naver", configured: false, connected: false, detail: "네이버 개발자 애플리케이션 설정이 필요합니다.", limitation } };
  if (!token?.access_token) return { state: { id: "naver", name: "Naver", configured: true, connected: false, detail: "네이버 계정 연결이 필요합니다.", limitation } };
  try { const response = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" }); const data = await response.json(); if (!response.ok || data.resultcode !== "00") throw new Error(); return { state: { id: "naver", name: "Naver", configured: true, connected: true, detail: "네이버 로그인과 프로필 조회가 정상입니다.", account: data.response?.nickname || data.response?.name || data.response?.email || "네이버 계정", limitation } }; } catch { return { state: { id: "naver", name: "Naver", configured: true, connected: false, detail: "네이버 토큰을 다시 연결해주세요.", limitation } }; }
}

export async function GET(request: NextRequest) {
  const [youtube, blogger, naver] = await Promise.all([youtubeState(request), bloggerState(request), naverState(request)]);
  const temuConfigured = Boolean(process.env.TEMU_AFFILIATE_ID?.trim() || process.env.TEMU_AFFILIATE_LINK_TEMPLATE?.trim());
  const states: ConnectionState[] = [youtube.state, blogger.state, naver.state, { id: "temu", name: "Temu Affiliate", configured: temuConfigured, connected: temuConfigured, detail: temuConfigured ? "제휴 링크 운영 정보가 등록되었습니다." : "Temu 제휴 링크 또는 Affiliate ID를 등록하세요.", limitation: "공개 제휴 API가 없는 계정은 상품별 제휴 링크 저장 방식으로 운영합니다." }];
  const response = NextResponse.json({ success: true, connections: states, core: { openai: Boolean(process.env.OPENAI_API_KEY?.trim()), supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) } });
  if (youtube.refreshedToken) response.cookies.set("gy_youtube_token", encryptConnectionValue(youtube.refreshedToken), CONNECTION_COOKIE_OPTIONS);
  if (blogger.refreshedToken) response.cookies.set("gy_blogger_token", encryptConnectionValue(blogger.refreshedToken), CONNECTION_COOKIE_OPTIONS);
  return response;
}
