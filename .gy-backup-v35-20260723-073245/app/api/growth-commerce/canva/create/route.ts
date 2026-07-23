import { NextRequest, NextResponse } from "next/server";
import { CONNECTION_COOKIE_OPTIONS, decryptConnectionValue, encryptConnectionValue } from "@/lib/connections/secure-cookie";
import { canvaJson, refreshCanvaToken, tokenLikelyExpired, type CanvaToken } from "@/lib/growth-commerce/canva";

export const runtime = "nodejs";
export const maxDuration = 120;

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const imageUrl = String(body.imageUrl || "").trim();
    const title = String(body.title || "GY-NEXUS Thumbnail").trim().slice(0, 255);
    const format = body.format === "youtube" ? "youtube" : "shorts";
    if (!imageUrl.startsWith("https://")) return NextResponse.json({ success: false, message: "HTTPS 이미지 URL이 필요합니다." }, { status: 400 });
    let token = decryptConnectionValue<CanvaToken>(request.cookies.get("gy_canva_token")?.value);
    if (!token?.access_token) return NextResponse.json({ success: false, message: "Canva 계정을 먼저 연결해주세요." }, { status: 401 });
    if (tokenLikelyExpired(token)) token = await refreshCanvaToken(token) || token;

    const imageResponse = await fetch(imageUrl, { cache: "no-store" });
    if (!imageResponse.ok) throw new Error(`썸네일 이미지 다운로드 실패 (${imageResponse.status})`);
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    if (bytes.length > 50 * 1024 * 1024) throw new Error("Canva 이미지 자산은 50MB 이하여야 합니다.");
    const uploadResponse = await fetch("https://api.canva.com/rest/v1/asset-uploads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/octet-stream",
        "Asset-Upload-Metadata": JSON.stringify({ name_base64: Buffer.from(title.slice(0, 50)).toString("base64") }),
      },
      body: bytes,
      cache: "no-store",
    });
    const upload = await uploadResponse.json().catch(() => ({})) as { job?: { id?: string }; message?: string };
    if (!uploadResponse.ok || !upload.job?.id) throw new Error(upload.message || `Canva 업로드 시작 실패 (${uploadResponse.status})`);

    let assetId = "";
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await sleep(800 + attempt * 150);
      const job = await canvaJson<{ job?: { status?: string; asset?: { id?: string }; error?: { message?: string } } }>(token.access_token, `/asset-uploads/${upload.job.id}`);
      if (job.job?.status === "success" && job.job.asset?.id) { assetId = job.job.asset.id; break; }
      if (job.job?.status === "failed") throw new Error(job.job.error?.message || "Canva 자산 업로드 실패");
    }
    if (!assetId) throw new Error("Canva 자산 업로드가 완료되지 않았습니다. 잠시 후 다시 시도해주세요.");

    const dimensions = format === "youtube" ? { width: 1280, height: 720 } : { width: 1080, height: 1920 };
    const created = await canvaJson<{ design?: { id?: string; urls?: { edit_url?: string; view_url?: string } } }>(token.access_token, "/designs", {
      method: "POST",
      body: JSON.stringify({ type: "type_and_asset", design_type: { type: "custom", ...dimensions }, asset_id: assetId, title }),
    });
    if (!created.design?.urls?.edit_url) throw new Error("Canva 편집 주소를 받지 못했습니다.");
    const response = NextResponse.json({ success: true, designId: created.design.id, editUrl: created.design.urls.edit_url, viewUrl: created.design.urls.view_url, message: "Canva 편집 디자인을 만들었습니다." });
    response.cookies.set("gy_canva_token", encryptConnectionValue(token), CONNECTION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Canva 디자인 생성 실패" }, { status: 500 });
  }
}
