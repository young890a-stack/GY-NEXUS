type PublishResult = { success: boolean; externalId?: string; message: string };

export async function publishToWebhook(payload: {
  title: string;
  content: string;
  channel: string;
}) : Promise<PublishResult> {
  const url = process.env.AUTOMATION_WEBHOOK_URL;
  if (!url) return { success: false, message: "AUTOMATION_WEBHOOK_URL이 설정되지 않았습니다." };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.AUTOMATION_WEBHOOK_SECRET ? { "x-gy-secret": process.env.AUTOMATION_WEBHOOK_SECRET } : {}) },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return { success: false, message: `웹훅 게시 실패 (${response.status})` };
  const data = await response.json().catch(() => ({}));
  return { success: true, externalId: String(data.id || data.externalId || ""), message: "웹훅 전송 완료" };
}

export async function publishToWordPress(payload: { title: string; content: string }): Promise<PublishResult> {
  const base = process.env.WORDPRESS_URL?.replace(/\/$/, "");
  const user = process.env.WORDPRESS_USERNAME;
  const password = process.env.WORDPRESS_APP_PASSWORD;
  if (!base || !user || !password) return { success: false, message: "WordPress 연결 정보가 없습니다." };
  const auth = Buffer.from(`${user}:${password}`).toString("base64");
  const response = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ title: payload.title, content: payload.content, status: "publish" }),
  });
  if (!response.ok) return { success: false, message: `WordPress 게시 실패 (${response.status})` };
  const data = await response.json();
  return { success: true, externalId: String(data.id || ""), message: "WordPress 게시 완료" };
}
