import type { OAuthToken } from "@/lib/connections/types";

type YouTubeResult = {
  success: boolean;
  externalId?: string;
  url?: string;
  message: string;
  token?: OAuthToken;
};

async function refreshToken(token: OAuthToken): Promise<OAuthToken | null> {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret || !token.refresh_token) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = (await response.json()) as Partial<OAuthToken>;
  if (!data.access_token) return null;
  return { ...token, ...data, refresh_token: token.refresh_token, created_at: Date.now() };
}

async function upload(
  accessToken: string,
  video: Blob,
  filename: string,
  title: string,
  description: string,
  privacyStatus: "private" | "unlisted" | "public",
) {
  const metadata = {
    snippet: { title: title.slice(0, 100), description, categoryId: "22" },
    status: { privacyStatus, selfDeclaredMadeForKids: false },
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" }));
  form.append("video", video, filename);
  return fetch("https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
}

export async function publishVideoToYouTube(input: {
  token: OAuthToken;
  videoUrl: string;
  title: string;
  description: string;
  privacyStatus?: "private" | "unlisted" | "public";
}): Promise<YouTubeResult> {
  const remote = await fetch(input.videoUrl, { cache: "no-store" });
  if (!remote.ok) {
    return { success: false, message: `영상 다운로드 실패 (${remote.status})`, token: input.token };
  }
  const blob = await remote.blob();
  if (!blob.size) return { success: false, message: "업로드할 영상이 비어 있습니다.", token: input.token };
  if (blob.size > 256 * 1024 * 1024) {
    return { success: false, message: "자동 업로더는 256MB 이하 영상을 지원합니다.", token: input.token };
  }

  let token = input.token;
  let response = await upload(
    token.access_token,
    blob,
    "gy-nexus-shorts.mp4",
    input.title,
    input.description,
    input.privacyStatus || "private",
  );

  if (response.status === 401 && token.refresh_token) {
    const refreshed = await refreshToken(token);
    if (refreshed) {
      token = refreshed;
      response = await upload(
        token.access_token,
        blob,
        "gy-nexus-shorts.mp4",
        input.title,
        input.description,
        input.privacyStatus || "private",
      );
    }
  }

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!response.ok || !data.id) {
    return {
      success: false,
      message: data.error?.message || `YouTube 업로드 실패 (${response.status})`,
      token,
    };
  }
  return {
    success: true,
    externalId: data.id,
    url: `https://youtu.be/${data.id}`,
    message: "YouTube Shorts 비공개 업로드 완료",
    token,
  };
}
