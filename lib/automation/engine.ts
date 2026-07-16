import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAiContent } from "@/lib/ai/generate";
import { generateCreativeImage } from "@/lib/creative-studio/image";
import { generateCreativeVideo } from "@/lib/creative-studio/video";
import { publishToBlogger } from "@/lib/publishing/blogger";
import { publishToWordPress, publishToWebhook } from "@/lib/publishing/publish";
import { publishVideoToYouTube } from "@/lib/publishing/youtube";
import type { OAuthToken } from "@/lib/connections/types";

export type AutomationConfig = {
  generateImage?: boolean;
  generateVideo?: boolean;
  publishBlogger?: boolean;
  publishYouTube?: boolean;
  publishWordPress?: boolean;
  publishWebhook?: boolean;
  bloggerDraft?: boolean;
  youtubePrivacy?: "private" | "unlisted" | "public";
};

export type AutomationTokens = {
  blogger?: OAuthToken | null;
  youtube?: OAuthToken | null;
};

export type AutomationTokenUpdates = {
  blogger?: OAuthToken;
  youtube?: OAuthToken;
};

type JobRow = {
  id: string;
  product_id?: string | null;
  attempts?: number | null;
  max_attempts?: number | null;
  config?: AutomationConfig | null;
  result_data?: Record<string, unknown> | null;
};

type ProductRow = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  affiliate_url?: string | null;
};

async function writeLog(
  supabase: SupabaseClient,
  jobId: string,
  runId: string,
  step: string,
  status: "running" | "completed" | "failed" | "skipped",
  message: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("automation_job_logs").insert({
    job_id: jobId,
    run_id: runId,
    step,
    status,
    message,
    details,
  });
}

async function setJob(
  supabase: SupabaseClient,
  jobId: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("automation_jobs")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw error;
}

function htmlContent(value: string) {
  return value
    .split(/\n{2,}/)
    .map((part) => `<p>${part.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export async function processAutomationJob(input: {
  supabase: SupabaseClient;
  job: JobRow;
  tokens: AutomationTokens;
}): Promise<{ tokenUpdates: AutomationTokenUpdates; result: Record<string, unknown> }> {
  const { supabase, job } = input;
  const config = job.config || {};
  const maxAttempts = Number(job.max_attempts || 3);
  const attempt = Number(job.attempts || 0) + 1;
  const previous = { ...(job.result_data || {}) } as Record<string, unknown>;
  const tokenUpdates: AutomationTokenUpdates = {};

  const { data: run, error: runError } = await supabase
    .from("automation_runs")
    .insert({
      run_type: "sprint6_pipeline",
      status: "running",
      selected_product_id: job.product_id || null,
      started_at: new Date().toISOString(),
      details: { job_id: job.id, config, attempt },
      step_status: {},
    })
    .select("id")
    .single();
  if (runError || !run) throw runError || new Error("자동화 실행 기록 생성 실패");
  const runId = run.id as string;

  await setJob(supabase, job.id, {
    status: "processing",
    attempts: attempt,
    started_at: new Date().toISOString(),
    last_error: null,
  });

  const stepStatus: Record<string, string> = {};
  const updateRun = async () => {
    await supabase.from("automation_runs").update({ step_status: stepStatus }).eq("id", runId);
  };

  try {
    await writeLog(supabase, job.id, runId, "product", "running", "상품을 선택하고 있습니다.");
    let product: ProductRow | null = null;
    if (job.product_id) {
      const { data, error } = await supabase.from("products").select("*").eq("id", job.product_id).maybeSingle();
      if (error) throw error;
      product = data as ProductRow | null;
    } else {
      const { data: trend } = await supabase
        .from("trend_products")
        .select("*")
        .eq("is_active", true)
        .order("ai_score", { ascending: false })
        .order("trend_score", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (trend) {
        if (trend.product_id) {
          const { data } = await supabase.from("products").select("*").eq("id", trend.product_id).maybeSingle();
          product = data as ProductRow | null;
        } else {
          const { data, error } = await supabase
            .from("products")
            .insert({
              title: trend.title,
              description: trend.description,
              image_url: trend.image_url,
              affiliate_url: trend.affiliate_url,
              platform: trend.platform,
              price_text: trend.price_text,
            })
            .select("*")
            .single();
          if (error) throw error;
          product = data as ProductRow;
          await supabase.from("trend_products").update({ product_id: product.id }).eq("id", trend.id);
        }
      }
      if (!product) {
        const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        product = data as ProductRow | null;
      }
    }
    if (!product) throw new Error("자동화할 상품이 없습니다. 상품을 먼저 등록해주세요.");
    previous.productId = product.id;
    previous.productTitle = product.title;
    stepStatus.product = "completed";
    await updateRun();
    await writeLog(supabase, job.id, runId, "product", "completed", `상품 선택 완료: ${product.title}`, { productId: product.id });

    let content = typeof previous.content === "string" ? previous.content : "";
    let contentId = typeof previous.contentId === "string" ? previous.contentId : "";
    if (!content) {
      stepStatus.content = "running"; await updateRun();
      await writeLog(supabase, job.id, runId, "content", "running", "OpenAI가 블로그·쇼츠 패키지를 생성합니다.");
      content = await generateAiContent({ kind: "bundle", title: product.title, description: product.description || "" });
      const { data, error } = await supabase.from("ai_contents").insert({
        product_id: product.id,
        product_title: product.title,
        content_type: "package",
        title: `${product.title} 전체 콘텐츠 패키지`,
        content,
      }).select("id").single();
      if (error) throw error;
      contentId = data.id;
      previous.content = content;
      previous.contentId = contentId;
      stepStatus.content = "completed"; await updateRun();
      await writeLog(supabase, job.id, runId, "content", "completed", "콘텐츠 생성과 저장을 완료했습니다.", { contentId });
    } else {
      stepStatus.content = "completed";
      await writeLog(supabase, job.id, runId, "content", "skipped", "이전 성공 결과를 재사용합니다.", { contentId });
    }

    let imageUrl = typeof previous.imageUrl === "string" ? previous.imageUrl : "";
    if (config.generateImage) {
      if (!imageUrl) {
        stepStatus.image = "running"; await updateRun();
        await writeLog(supabase, job.id, runId, "image", "running", "OpenAI 이미지 생성을 시작합니다.");
        const image = await generateCreativeImage({
          title: product.title,
          kind: "shorts_cover",
          size: "1024x1536",
          prompt: `세로형 프리미엄 상품 광고 이미지. 상품명: ${product.title}. ${product.description || ""}. 제품 중심, 네이비와 퍼플의 세련된 배경, 깨끗한 스튜디오 조명, 20~40대가 신뢰할 수 있는 분위기, 이미지 안 한글 문구 없음.`,
        });
        imageUrl = image.assetUrl;
        previous.imageUrl = imageUrl;
        await supabase.from("creative_jobs").insert({
          job_type: "image", title: product.title, prompt: "Sprint 6 자동 이미지", provider: image.provider,
          status: "completed", output_data: image, asset_url: imageUrl, completed_at: new Date().toISOString(),
        });
        stepStatus.image = "completed"; await updateRun();
        await writeLog(supabase, job.id, runId, "image", "completed", "상품 광고 이미지 생성 완료", { imageUrl });
      } else {
        stepStatus.image = "completed";
        await writeLog(supabase, job.id, runId, "image", "skipped", "이전 생성 이미지를 재사용합니다.", { imageUrl });
      }
    } else {
      stepStatus.image = "skipped";
      await writeLog(supabase, job.id, runId, "image", "skipped", "이미지 생성 옵션이 꺼져 있습니다.");
    }

    let videoUrl = typeof previous.videoUrl === "string" ? previous.videoUrl : "";
    if (config.generateVideo) {
      if (!videoUrl) {
        stepStatus.video = "running"; await updateRun();
        await writeLog(supabase, job.id, runId, "video", "running", "Runway 5초 세로 영상을 생성합니다.");
        const video = await generateCreativeVideo({
          title: product.title,
          sourceImageUrl: imageUrl || product.image_url || undefined,
          duration: 5,
          ratio: "720:1280",
          prompt: `세로형 9:16 상품 광고 영상. 첫 2초는 영화 같은 빠른 클로즈업, ${product.title}의 핵심 장점을 자연스럽게 보여주고 부드러운 카메라 움직임, 과장 없는 현실적인 장면, 마지막은 깔끔한 제품 중심 마무리. 자막과 화면 글자 없음.`,
        });
        videoUrl = video.assetUrl;
        previous.videoUrl = videoUrl;
        await supabase.from("creative_jobs").insert({
          job_type: "video", title: product.title, prompt: "Sprint 6 자동 영상", provider: video.provider,
          provider_task_id: video.taskId, status: "completed", output_data: video, asset_url: videoUrl, completed_at: new Date().toISOString(),
        });
        stepStatus.video = "completed"; await updateRun();
        await writeLog(supabase, job.id, runId, "video", "completed", "Runway 영상 생성 완료", { videoUrl });
      } else {
        stepStatus.video = "completed";
        await writeLog(supabase, job.id, runId, "video", "skipped", "이전 생성 영상을 재사용합니다.", { videoUrl });
      }
    } else {
      stepStatus.video = "skipped";
      await writeLog(supabase, job.id, runId, "video", "skipped", "영상 생성 옵션이 꺼져 있습니다.");
    }

    const postTitle = `${product.title} 활용 가이드`;
    const postBody = htmlContent(content) + (product.affiliate_url ? `<p><a href="${product.affiliate_url}">상품 자세히 보기</a></p>` : "");

    if (config.publishBlogger) {
      stepStatus.blogger = "running"; await updateRun();
      await writeLog(supabase, job.id, runId, "blogger", "running", "Blogger 게시를 시작합니다.");
      if (!input.tokens.blogger?.access_token) throw new Error("Blogger 계정을 통합 연결센터에서 먼저 연결해주세요.");
      const result = await publishToBlogger({ token: input.tokens.blogger, title: postTitle, content: postBody, isDraft: config.bloggerDraft !== false });
      if (result.token) tokenUpdates.blogger = result.token;
      if (!result.success) throw new Error(result.message);
      previous.bloggerUrl = result.url || "";
      stepStatus.blogger = "completed"; await updateRun();
      await writeLog(supabase, job.id, runId, "blogger", "completed", result.message, { url: result.url, externalId: result.externalId });
    } else { stepStatus.blogger = "skipped"; }

    if (config.publishWordPress) {
      stepStatus.wordpress = "running"; await updateRun();
      const result = await publishToWordPress({ title: postTitle, content: postBody });
      if (!result.success) throw new Error(result.message);
      previous.wordpressId = result.externalId || "";
      stepStatus.wordpress = "completed"; await updateRun();
      await writeLog(supabase, job.id, runId, "wordpress", "completed", result.message, { externalId: result.externalId });
    } else { stepStatus.wordpress = "skipped"; }

    if (config.publishWebhook) {
      stepStatus.webhook = "running"; await updateRun();
      const result = await publishToWebhook({ title: postTitle, content, channel: "sprint6" });
      if (!result.success) throw new Error(result.message);
      stepStatus.webhook = "completed"; await updateRun();
      await writeLog(supabase, job.id, runId, "webhook", "completed", result.message, { externalId: result.externalId });
    } else { stepStatus.webhook = "skipped"; }

    if (config.publishYouTube) {
      stepStatus.youtube = "running"; await updateRun();
      await writeLog(supabase, job.id, runId, "youtube", "running", "YouTube Shorts 업로드를 시작합니다.");
      if (!videoUrl) throw new Error("YouTube 업로드에 필요한 생성 영상이 없습니다.");
      if (!input.tokens.youtube?.access_token) throw new Error("YouTube 계정을 통합 연결센터에서 먼저 연결해주세요.");
      const result = await publishVideoToYouTube({
        token: input.tokens.youtube,
        videoUrl,
        title: `${product.title} 핵심 장점 #shorts`,
        description: `${product.title}\n\n${product.affiliate_url || ""}\n\n제휴 링크를 통해 구매 시 일정 수수료를 받을 수 있습니다.`,
        privacyStatus: config.youtubePrivacy || "private",
      });
      if (result.token) tokenUpdates.youtube = result.token;
      if (!result.success) throw new Error(result.message);
      previous.youtubeUrl = result.url || "";
      stepStatus.youtube = "completed"; await updateRun();
      await writeLog(supabase, job.id, runId, "youtube", "completed", result.message, { url: result.url, externalId: result.externalId });
    } else { stepStatus.youtube = "skipped"; }

    await setJob(supabase, job.id, {
      status: "completed",
      result_data: previous,
      completed_at: new Date().toISOString(),
      current_step: "completed",
      last_error: null,
    });
    await supabase.from("automation_runs").update({
      status: "completed", completed_at: new Date().toISOString(), step_status: stepStatus,
      details: { job_id: job.id, product: product.title, ...previous },
    }).eq("id", runId);
    await writeLog(supabase, job.id, runId, "pipeline", "completed", "Sprint 6 전체 워크플로우가 완료됐습니다.");
    return { tokenUpdates, result: previous };
  } catch (error) {
    const message = error instanceof Error ? error.message : "자동화 처리 실패";
    const nextStatus = attempt >= maxAttempts ? "failed" : "retry";
    await setJob(supabase, job.id, {
      status: nextStatus,
      result_data: previous,
      current_step: Object.keys(stepStatus).find((key) => stepStatus[key] === "running") || "unknown",
      last_error: message,
      completed_at: nextStatus === "failed" ? new Date().toISOString() : null,
      scheduled_at: nextStatus === "retry" ? new Date(Date.now() + 60_000).toISOString() : undefined,
    });
    await supabase.from("automation_runs").update({
      status: "failed", completed_at: new Date().toISOString(), error_message: message, step_status: stepStatus,
      details: { job_id: job.id, ...previous },
    }).eq("id", runId);
    await writeLog(supabase, job.id, runId, "pipeline", "failed", message, { nextStatus, attempt, maxAttempts });
    throw new Error(message);
  }
}
