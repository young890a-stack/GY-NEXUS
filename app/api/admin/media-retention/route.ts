import { NextResponse } from "next/server";
import { AuthorizationError, requireOwner } from "@/lib/auth/require-owner";
import { findExpiredCreativeAssets, removeCreativeAssets } from "@/lib/creative-studio/retention";

export const dynamic = "force-dynamic";
type RequestBody = { mode?: "preview" | "delete"; retentionDays?: number };

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("media retention failed", error);
  return NextResponse.json({ error: "미디어 보관 상태를 확인하지 못했습니다." }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    const body = (await request.json()) as RequestBody;
    const retentionDays = Number(body.retentionDays ?? 90);
    const mode = body.mode ?? "preview";
    if (!Number.isInteger(retentionDays) || retentionDays < 30 || retentionDays > 3650) {
      return NextResponse.json({ error: "보관 기간은 30일에서 3650일 사이로 입력해주세요." }, { status: 400 });
    }
    if (mode !== "preview" && mode !== "delete") {
      return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
    }

    const assets = await findExpiredCreativeAssets(retentionDays);
    const totalBytes = assets.reduce((sum, asset) => sum + asset.size, 0);
    if (mode === "delete") await removeCreativeAssets(assets.map((asset) => asset.path));

    return NextResponse.json({
      mode,
      retentionDays,
      count: assets.length,
      totalBytes,
      truncated: assets.length >= 500,
      assets: assets.slice(0, 100),
      completedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

