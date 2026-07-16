import type { OAuthToken } from "@/lib/connections/types";

type BloggerResult = { success: boolean; externalId?: string; url?: string; message: string; token?: OAuthToken };

async function refreshToken(token: OAuthToken): Promise<OAuthToken | null> {
  const clientId = (process.env.BLOGGER_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID)?.trim();
  const clientSecret = (process.env.BLOGGER_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET)?.trim();
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

async function resolveBlogId(accessToken: string): Promise<string | null> {
  const configured = process.env.BLOGGER_BLOG_ID?.trim();
  if (configured) return configured;

  const response = await fetch("https://www.googleapis.com/blogger/v3/users/self/blogs", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { items?: Array<{ id?: string }> };
  return data.items?.find((item) => item.id)?.id || null;
}

async function publish(accessToken: string, blogId: string, title: string, content: string, isDraft: boolean) {
  return fetch(`https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}/posts/?isDraft=${isDraft ? "true" : "false"}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kind: "blogger#post", title, content }),
    cache: "no-store",
  });
}

export async function publishToBlogger(input: {
  token: OAuthToken;
  title: string;
  content: string;
  isDraft?: boolean;
}): Promise<BloggerResult> {
  let token = input.token;
  let blogId = await resolveBlogId(token.access_token);

  if (!blogId && token.refresh_token) {
    const refreshed = await refreshToken(token);
    if (refreshed) {
      token = refreshed;
      blogId = await resolveBlogId(token.access_token);
    }
  }

  if (!blogId) {
    return { success: false, message: "Blogger 블로그를 찾지 못했습니다. 연결 상태와 BLOGGER_BLOG_ID를 확인해주세요.", token };
  }

  let response = await publish(token.access_token, blogId, input.title, input.content, Boolean(input.isDraft));
  if (response.status === 401 && token.refresh_token) {
    const refreshed = await refreshToken(token);
    if (refreshed) {
      token = refreshed;
      response = await publish(token.access_token, blogId, input.title, input.content, Boolean(input.isDraft));
    }
  }

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.id) {
    return { success: false, message: data.error?.message || `Blogger 게시 실패 (${response.status})`, token };
  }

  return {
    success: true,
    externalId: data.id,
    url: data.url,
    message: input.isDraft ? "Blogger 초안 저장 완료" : "Blogger 게시 완료",
    token,
  };
}
