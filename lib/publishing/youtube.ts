import type { OAuthToken } from "@/lib/connections/types";

type YouTubeResult = { success: boolean; externalId?: string; url?: string; message: string; token?: OAuthToken };

type Privacy = "private" | "unlisted" | "public";

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

async function uploadVideo(accessToken: string, video: Blob, input: { title: string; description: string; tags?: string[]; privacyStatus: Privacy; publishAt?: string }) {
  const status: Record<string, unknown> = { privacyStatus: input.publishAt ? "private" : input.privacyStatus, selfDeclaredMadeForKids: false };
  if (input.publishAt) status.publishAt = input.publishAt;
  const metadata = { snippet: { title: input.title.slice(0, 100), description: input.description, tags: input.tags?.slice(0, 50), categoryId: "22" }, status };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" }));
  form.append("video", video, "gy-nexus-video.mp4");
  return fetch("https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: form, cache: "no-store",
  });
}

async function setThumbnail(accessToken: string, videoId: string, thumbnailUrl?: string) {
  if (!thumbnailUrl) return;
  const remote = await fetch(thumbnailUrl, { cache: "no-store" });
  if (!remote.ok) throw new Error(`썸네일 다운로드 실패 (${remote.status})`);
  const blob = await remote.blob();
  if (blob.size > 2 * 1024 * 1024) throw new Error("YouTube 썸네일은 2MB 이하만 지원합니다.");
  const response = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": blob.type || "image/jpeg" }, body: blob, cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message || `썸네일 업로드 실패 (${response.status})`);
  }
}

export async function publishVideoToYouTube(input: {
  token: OAuthToken; videoUrl: string; title: string; description: string; tags?: string[];
  thumbnailUrl?: string; privacyStatus?: Privacy; publishAt?: string;
}): Promise<YouTubeResult> {
  const remote = await fetch(input.videoUrl, { cache: "no-store" });
  if (!remote.ok) return { success: false, message: `영상 다운로드 실패 (${remote.status})`, token: input.token };
  const blob = await remote.blob();
  if (!blob.size) return { success: false, message: "업로드할 영상이 비어 있습니다.", token: input.token };
  if (blob.size > 256 * 1024 * 1024) return { success: false, message: "GY-NEXUS 자동 업로더는 256MB 이하 영상을 지원합니다.", token: input.token };

  let token = input.token;
  let response = await uploadVideo(token.access_token, blob, {
    title: input.title, description: input.description, tags: input.tags,
    privacyStatus: input.privacyStatus || "private", publishAt: input.publishAt,
  });
  if (response.status === 401 && token.refresh_token) {
    const refreshed = await refreshToken(token);
    if (refreshed) { token = refreshed; response = await uploadVideo(token.access_token, blob, { title: input.title, description: input.description, tags: input.tags, privacyStatus: input.privacyStatus || "private", publishAt: input.publishAt }); }
  }
  const data = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) return { success: false, message: data.error?.message || `YouTube 업로드 실패 (${response.status})`, token };
  try { await setThumbnail(token.access_token, data.id, input.thumbnailUrl); }
  catch (error) { return { success: true, externalId: data.id, url: `https://youtu.be/${data.id}`, message: `영상 업로드 완료 · ${error instanceof Error ? error.message : "썸네일 설정 실패"}`, token }; }
  return { success: true, externalId: data.id, url: `https://youtu.be/${data.id}`, message: input.publishAt ? "YouTube 예약 업로드 완료" : "YouTube 업로드 완료", token };
}
