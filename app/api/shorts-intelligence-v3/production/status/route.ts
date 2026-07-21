import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Row = Record<string, any>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const runId = String(url.searchParams.get("runId") || "").trim();
    const supabase = createAdminClient();

    const runsPromise = supabase.from("china_discovery_runs")
      .select("id,query,collected_candidate_count,analyzed_candidate_count,status,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    const candidatesPromise = runId
      ? supabase.from("china_video_candidates")
        .select("id,run_id,title,platform,url,thumbnail_url,total_intelligence_score,scene_analysis_rank,scene_analysis_status,scene_analysis_score,scene_analysis_summary")
        .eq("run_id", runId)
        .eq("scene_analysis_status", "completed")
        .order("scene_analysis_rank", { ascending: true })
        .limit(30)
      : Promise.resolve({ data: [], error: null });
    const batchesQuery = supabase.from("shorts_production_batches_v34")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    const batchesPromise = runId ? batchesQuery.eq("run_id", runId) : batchesQuery;

    const [runsResult, candidatesResult, batchesResult] = await Promise.all([runsPromise, candidatesPromise, batchesPromise]);
    if (runsResult.error) throw runsResult.error;
    if (candidatesResult.error) throw candidatesResult.error;
    if (batchesResult.error) throw batchesResult.error;

    const batches = batchesResult.data || [];
    const batchIds = (batches as Row[]).map((item: Row) => item.id);
    const variantsResult = batchIds.length
      ? await supabase.from("shorts_production_variants_v34").select("*").in("batch_id", batchIds).order("variant_key")
      : { data: [], error: null };
    if (variantsResult.error) throw variantsResult.error;
    const variants = variantsResult.data || [];
    const projectIds = (variants as Row[]).map((item: Row) => item.video_project_id).filter(Boolean);
    const projectsResult = projectIds.length
      ? await supabase.from("video_projects")
        .select("id,title,status,render_approved,render_approved_at,final_video_url,error_message,quality_threshold,settings,updated_at")
        .in("id", projectIds)
      : { data: [], error: null };
    if (projectsResult.error) throw projectsResult.error;
    const scenesResult = projectIds.length
      ? await supabase.from("video_scenes")
        .select("id,project_id,scene_number,status,quality_status,quality_score,quality_report,selected_image_url,video_url,error_message")
        .in("project_id", projectIds)
        .order("scene_number")
      : { data: [], error: null };
    if (scenesResult.error) throw scenesResult.error;

    const projectMap = new Map<string, Row>(((projectsResult.data || []) as Row[]).map((project: Row) => [String(project.id), project]));
    const sceneMap = new Map<string, Array<Record<string, unknown>>>();
    for (const scene of (scenesResult.data || []) as Row[]) {
      const current = sceneMap.get(scene.project_id) || [];
      current.push(scene);
      sceneMap.set(scene.project_id, current);
    }
    const variantsByBatch = new Map<string, Array<Record<string, unknown>>>();
    for (const variant of variants as Row[]) {
      const project: Row | null = variant.video_project_id ? projectMap.get(String(variant.video_project_id)) || null : null;
      const settings = record(project?.settings);
      const projectScenes = project ? sceneMap.get(project.id) || [] : [];
      const enriched = {
        ...variant,
        project: project ? {
          id: project.id,
          title: project.title,
          status: project.status,
          renderApproved: project.render_approved,
          renderApprovedAt: project.render_approved_at,
          finalVideoUrl: project.final_video_url,
          errorMessage: project.error_message,
          qualityThreshold: project.quality_threshold,
          contentApprovedAt: settings.contentApprovedAt || null,
          selectedHook: settings.selectedHook || null,
          voiceAudioUrl: settings.voiceAudioUrl || null,
          commercePackage: settings.commercePackage || null,
          updatedAt: project.updated_at,
        } : null,
        scenes: projectScenes,
        progress: {
          sceneCount: projectScenes.length,
          imageApproved: projectScenes.filter((scene) => scene.quality_status === "approved").length,
          clipsCompleted: projectScenes.filter((scene) => scene.status === "completed" && scene.video_url).length,
        },
      };
      const current = variantsByBatch.get(variant.batch_id) || [];
      current.push(enriched);
      variantsByBatch.set(variant.batch_id, current);
    }

    return NextResponse.json({
      success: true,
      runs: runsResult.data || [],
      candidates: candidatesResult.data || [],
      batches: (batches as Row[]).map((batch: Row) => ({ ...batch, variants: variantsByBatch.get(batch.id) || [] })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "V3-4 제작 현황을 불러오지 못했습니다." }, { status: 500 });
  }
}
