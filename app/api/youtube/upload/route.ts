import { NextRequest, NextResponse } from "next/server";
import { decryptConnectionValue } from "@/lib/connections/secure-cookie";
import type { OAuthToken } from "@/lib/connections/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function refreshToken(token: OAuthToken): Promise<OAuthToken | null> {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret || !token.refresh_token) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: token.refresh_token, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = (await response.json()) as Partial<OAuthToken>;
  if (!data.access_token) return null;
  return { ...token, ...data, refresh_token: token.refresh_token, created_at: Date.now() };
}

async function upload(accessToken: string, file: File, title: string, description: string, privacyStatus: string) {
  const metadata = { snippet: { title, description, categoryId: "22" }, status: { privacyStatus, selfDeclaredMadeForKids: false } };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" }));
  form.append("video", file, file.name);
  return fetch("https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: form,
  });
}

export async function POST(request: NextRequest) {
  try {
    let token = decryptConnectionValue<OAuthToken>(request.cookies.get("gy_youtube_token")?.value);
    if (!token?.access_token) return NextResponse.json({ success: false, message: "YouTube 계정을 먼저 연결해주세요." }, { status: 401 });
    const form = await request.formData();
    const file = form.get("video");
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const requestedPrivacy = String(form.get("privacyStatus") || "private");
    const privacyStatus = ["private", "unlisted", "public"].includes(requestedPrivacy) ? requestedPrivacy : "private";
    if (!(file instanceof File) || !file.size) return NextResponse.json({ success: false, message: "업로드할 MP4 파일을 선택해주세요." }, { status: 400 });
    if (!title) return NextResponse.json({ success: false, message: "영상 제목을 입력해주세요." }, { status: 400 });
    if (file.size > 256 * 1024 * 1024) return NextResponse.json({ success: false, message: "현재 운영형 업로더는 256MB 이하 파일을 지원합니다." }, { status: 413 });
    let response = await upload(token.access_token, file, title, description, privacyStatus);
    if (response.status === 401 && token.refresh_token) {
      const refreshed = await refreshToken(token);
      if (refreshed) { token = refreshed; response = await upload(token.access_token, file, title, description, privacyStatus); }
    }
    const data = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
    if (!response.ok || !data.id) return NextResponse.json({ success: false, message: data.error?.message || "YouTube 업로드에 실패했습니다." }, { status: response.status || 500 });
    return NextResponse.json({ success: true, videoId: data.id, url: `https://youtu.be/${data.id}` });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "YouTube 업로드 중 오류가 발생했습니다." }, { status: 500 });
  }
}
