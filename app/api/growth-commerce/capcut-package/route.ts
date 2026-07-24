import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { zipTextFiles } from "@/lib/growth-commerce/zip";

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function clean(value: unknown) { return String(value || "").trim(); }
function srtTime(value: number) { const ms = Math.max(0, Math.round(value * 1000)); const h = Math.floor(ms / 3600000); const m = Math.floor(ms % 3600000 / 60000); const s = Math.floor(ms % 60000 / 1000); return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms%1000).padStart(3,"0")}`; }

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const variantId = clean(body.variantId);
    const requestedProjectId = clean(body.projectId);
    if (!variantId && !requestedProjectId) return NextResponse.json({ success: false, message: "variantId 또는 projectId가 필요합니다." }, { status: 400 });
    const supabase = createAdminClient();
    const { data: variant, error: variantError } = variantId
      ? await supabase.from("shorts_production_variants_v34").select("*").eq("id", variantId).single()
      : { data: null, error: null };
    if (variantId && (variantError || !variant)) throw variantError || new Error("V3-4 제작안을 찾지 못했습니다.");
    const projectId = requestedProjectId || clean(variant?.video_project_id);
    const { data: project, error: projectError } = await supabase.from("video_projects").select("*").eq("id", projectId).single();
    if (projectError || !project) throw projectError || new Error("연결된 영상 프로젝트를 찾지 못했습니다.");
    const { data: sceneRows } = await supabase.from("video_scenes").select("scene_number,start_second,end_second,narration,subtitle_text,selected_image_url,video_url").eq("project_id", project.id).order("scene_number", { ascending: true });
    const settings = record(project.settings);
    const commerce = record(settings.commercePackage);
    const cues = Array.isArray(commerce.subtitleCues) ? commerce.subtitleCues.map(record) : [];
    const scenes = Array.isArray(sceneRows) ? sceneRows : [];
    const srt = cues.length
      ? cues.map((cue, index) => `${index + 1}\n${srtTime(Number(cue.startSecond))} --> ${srtTime(Number(cue.endSecond))}\n${clean(cue.text)}\n`).join("\n")
      : scenes.map((scene, index) => `${index + 1}\n${srtTime(Number(scene.start_second))} --> ${srtTime(Number(scene.end_second))}\n${clean(scene.subtitle_text || scene.narration)}\n`).join("\n");
    const youtube = record(record(commerce.platformVersions).youtube);
    const plan = record(variant?.plan);
    const packageTitle = clean(variant?.title || project.title || project.product_name || "GY-NEXUS 쇼츠");
    const voiceover = clean(commerce.voiceover || plan.voiceover || scenes.map((scene) => clean(scene.narration)).filter(Boolean).join(" "));
    const scenePlan = Array.isArray(plan.scenes) && plan.scenes.length ? plan.scenes : scenes;
    const files = [
      { name: "00-START-HERE.txt", content: `GY-NEXUS CapCut Import Package V3.5\n\n1. CapCut 모바일/PC에서 새 세로 프로젝트(9:16)를 만듭니다.\n2. final-video-url.txt의 영상 또는 media-links.json의 장면을 불러옵니다.\n3. subtitles.srt를 자막 가져오기로 불러옵니다.\n4. title-description.txt를 YouTube/Instagram 게시 화면에 복사합니다.\n5. 대표 확인 후 게시합니다.\n\n주의: CapCut의 공개 범용 프로젝트 생성 API가 확인되지 않아 .capcut 프로젝트를 위조하지 않고, 안전한 표준 파일 패키지로 제공합니다.\n` },
      { name: "subtitles.srt", content: srt || "1\n00:00:00,000 --> 00:00:02,000\n자막을 V3-4에서 먼저 확정해주세요.\n" },
      { name: "script.txt", content: voiceover },
      { name: "title-description.txt", content: `TITLE\n${clean(youtube.title || packageTitle)}\n\nDESCRIPTION\n${clean(youtube.description || commerce.description || project.product_description)}\n\nHASHTAGS\n${Array.isArray(youtube.hashtags) ? youtube.hashtags.join(" ") : ""}` },
      { name: "final-video-url.txt", content: clean(project.final_video_url || variant?.final_video_url) },
      { name: "thumbnail-url.txt", content: clean(variant?.thumbnail_url || project.thumbnail_url) },
      { name: "media-links.json", content: JSON.stringify({ finalVideoUrl: project.final_video_url || variant?.final_video_url || null, sourceImageUrl: project.source_image_url || null, referenceImageUrls: project.reference_image_urls || [], sceneMedia: scenes.map((scene) => ({ imageUrl: scene.selected_image_url || null, videoUrl: scene.video_url || null })), thumbnailUrl: variant?.thumbnail_url || project.thumbnail_url || null }, null, 2) },
      { name: "scene-plan.json", content: JSON.stringify({ scenes: scenePlan, sourceMixPlan: settings.sourceMixPlan || null }, null, 2) },
      { name: "manifest.json", content: JSON.stringify({ version: "3.5", generatedAt: new Date().toISOString(), variantId: variantId || null, projectId: project.id, title: packageTitle, durationSeconds: project.duration_seconds, ratio: project.ratio, affiliateUrl: settings.affiliateUrl || settings.productUrl || null }, null, 2) },
    ];
    const zip = zipTextFiles(files);
    const safe = packageTitle.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 60) || "gy-nexus-capcut";
    const bodyBytes = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
    return new Response(bodyBytes, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safe)}-capcut.zip`, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "CapCut 패키지 생성 실패" }, { status: 500 });
  }
}
