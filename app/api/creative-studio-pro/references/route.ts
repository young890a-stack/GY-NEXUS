import { NextResponse } from "next/server";
import { buildStoragePath, uploadBuffer } from "@/lib/creative-studio/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
] as const);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form.getAll("images").filter((item): item is File => item instanceof File);
    const analysisMode = String(form.get("purpose") || "") === "analysis";
    const maxFiles = analysisMode ? 8 : 4;
    if (!files.length || files.length > maxFiles) {
      return NextResponse.json(
        { success: false, message: analysisMode ? "분석 프레임을 1~8장 선택해주세요." : "상품 사진을 1~4장 선택해주세요. 정확도를 위해 2장 이상을 권장합니다." },
        { status: 400 },
      );
    }

    for (const file of files) {
      const extension = allowedTypes.get(file.type as "image/png" | "image/jpeg" | "image/webp");
      if (!extension) {
        return NextResponse.json(
          { success: false, message: `${file.name}: PNG, JPG, WEBP 형식만 사용할 수 있습니다.` },
          { status: 400 },
        );
      }
      if (file.size < 1 || file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { success: false, message: `${file.name}: 사진 한 장은 8MB 이하여야 합니다.` },
          { status: 400 },
        );
      }
    }

    const urls = await Promise.all(files.map(async (file, index) => {
      const extension = allowedTypes.get(file.type as "image/png" | "image/jpeg" | "image/webp")!;
      const path = buildStoragePath({
        folder: "references",
        title: `${analysisMode ? "analysis-frame" : "product-reference"}-${index + 1}-${file.name}`,
        extension,
      });
      const assetUrl = await uploadBuffer({
        buffer: Buffer.from(await file.arrayBuffer()),
        path,
        contentType: file.type,
      });
      return assetUrl;
    }));

    return NextResponse.json({ success: true, urls });
  } catch (error) {
    console.error("REFERENCE IMAGE UPLOAD FAILED", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "상품 사진 업로드에 실패했습니다." },
      { status: 500 },
    );
  }
}
