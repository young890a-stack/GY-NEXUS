import { createServer } from "node:http";
import { promises as fs, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PORT = Number(process.env.PORT || 8080);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 600 * 1024 * 1024;
let queue = Promise.resolve();
let activeJobId = null;
let queuedJobs = 0;

function send(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

async function safeHttpsUrl(value, callback = false) {
  const parsed = new URL(String(value || ""));
  if (parsed.protocol !== "https:") throw new Error("HTTPS 파일 주소만 허용됩니다.");
  if (callback && process.env.GY_APP_ORIGIN && parsed.origin !== new URL(process.env.GY_APP_ORIGIN).origin) {
    throw new Error("허용되지 않은 콜백 주소입니다.");
  }
  const addresses = await lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) throw new Error("내부 네트워크 주소는 사용할 수 없습니다.");
  return parsed;
}

async function download(url, destination, expectedKind = "video") {
  const parsed = await safeHttpsUrl(url);
  const response = await fetch(parsed, { redirect: "follow", signal: AbortSignal.timeout(120000) });
  if (!response.ok || !response.body) throw new Error(`소재 다운로드 실패: ${response.status}`);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (expectedKind === "video" && !contentType.startsWith("video/")) throw new Error("직접 재생 가능한 영상 파일 주소가 아닙니다.");
  if (expectedKind === "audio" && !contentType.startsWith("audio/") && !contentType.includes("octet-stream")) throw new Error("직접 재생 가능한 음원 파일 주소가 아닙니다.");
  const announced = Number(response.headers.get("content-length") || 0);
  if (announced > MAX_DOWNLOAD_BYTES) throw new Error("소재 파일이 600MB를 초과합니다.");
  let received = 0;
  const guarded = Readable.fromWeb(response.body).map((chunk) => {
    received += chunk.length;
    if (received > MAX_DOWNLOAD_BYTES) throw new Error("소재 파일이 600MB를 초과합니다.");
    return chunk;
  });
  await pipeline(guarded, createWriteStream(destination));
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let errorText = "";
    child.stderr.on("data", (chunk) => { errorText = `${errorText}${chunk}`.slice(-12000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} 실패 (${code}): ${errorText.slice(-2000)}`)));
  });
}

function assTime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  const centis = Math.round((total - Math.floor(total)) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

function assText(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/[{}]/g, "").replace(/\n/g, "\\N");
}

async function createAss(path, cues, width, height, style) {
  const fontSize = Math.round(height * (style === "minimal" ? .034 : .044));
  const outline = style === "minimal" ? 2 : 5;
  const body = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: GY,Noto Sans CJK KR,${fontSize},&H00FFFFFF,&H000000FF,&HCC000000,&H70000000,-1,0,0,0,100,100,0,0,1,${outline},1,2,55,55,${Math.round(height * .1)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${cues.map((cue) => `Dialogue: 0,${assTime(cue.startSecond)},${assTime(cue.endSecond)},GY,,0,0,0,,${assText(cue.text)}`).join("\n")}
`;
  await fs.writeFile(path, body, "utf8");
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function mapWithConcurrency(items, concurrency, task) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function buildPlan(project, scenes) {
  const settings = record(project.settings);
  const recreateClean = settings.subtitleCleanupMode === "recreate-clean";
  const references = Array.isArray(settings.licensedFinalAssets) ? settings.licensedFinalAssets : [];
  const generated = scenes.filter((scene) => scene.video_url).map((scene) => ({
    url: scene.video_url,
    duration: Math.max(.7, Math.min(5, Number(scene.end_second) - Number(scene.start_second) || 5)),
    kind: "generated",
    sourceStartSecond: 0,
    sourceLimitEndSecond: null,
  }));
  const sourceMix = record(settings.sourceMixPlan);
  if (Array.isArray(sourceMix.cuts) && sourceMix.cuts.length) {
    const referenceMap = new Map(references
      .filter((item) => item && item.assetKind === "video-file" && item.useInFinal && item.rightsStatus !== "unverified")
      .map((item) => [item.id, item]));
    let sceneIndex = 0;
    return sourceMix.cuts.map((shot) => {
      const duration = Math.max(.7, Math.min(2.5, Number(shot.durationSeconds) || 1.5));
      const reference = referenceMap.get(String(shot.referenceId || ""));
      if (shot.decision === "use-licensed" && reference?.url && !recreateClean) {
        return {
          url: reference.url,
          duration,
          kind: "licensed",
          sourceStartSecond: Math.max(Number(reference.trimStartSecond) || 0, Number(shot.sourceStartSecond) || 0),
          sourceLimitEndSecond: Number(reference.trimEndSecond || reference.durationSeconds) || null,
        };
      }
      const source = generated[sceneIndex % Math.max(1, generated.length)];
      sceneIndex += 1;
      return source ? { ...source, duration, kind: "generated" } : null;
    }).filter(Boolean);
  }
  const reference = references.find((item) => item && item.useInFinal && item.rightsStatus !== "unverified" && item.analysis?.mixPlan?.length);
  if (!reference) return generated;
  let sceneIndex = 0;
  return reference.analysis.mixPlan.map((shot) => {
    const duration = Math.max(.7, Math.min(2.5, Number(shot.durationSeconds) || 1.5));
    if (shot.source === "licensed-video" && reference.url) return {
      url: reference.url,
      duration,
      kind: "licensed",
      sourceStartSecond: Number(reference.trimStartSecond) || 0,
      sourceLimitEndSecond: Number(reference.trimEndSecond || reference.durationSeconds) || null,
    };
    const source = generated[sceneIndex % Math.max(1, generated.length)];
    sceneIndex += 1;
    return source ? { ...source, duration } : null;
  }).filter(Boolean);
}

async function uploadOutput(filePath, projectId) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const bucket = String(process.env.CREATIVE_STORAGE_BUCKET || "creative-assets");
  if (!supabaseUrl || !serviceKey) throw new Error("Worker의 Supabase 환경변수가 없습니다.");
  const objectPath = `videos/${new Date().toISOString().slice(0, 10)}/${Date.now()}-gy-shorts-${String(projectId).replace(/[^a-z0-9-]/gi, "").slice(0, 40)}.mp4`;
  const data = await fs.readFile(filePath);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "video/mp4", "x-upsert": "true" },
    body: data,
  });
  if (!response.ok) throw new Error(`완성 영상 업로드 실패: ${response.status} ${await response.text()}`);
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
}

async function callback(url, payload) {
  await safeHttpsUrl(url, true);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.VIDEO_WORKER_SECRET}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`사이트 콜백 실패: ${response.status}`);
}

async function renderJob(jobId, body) {
  const root = await fs.mkdtemp(join(tmpdir(), `gy-${jobId}-`));
  let stage = "작업 준비";
  activeJobId = jobId;
  queuedJobs = Math.max(0, queuedJobs - 1);
  try {
    try { await callback(body.callbackUrl, { status: "rendering", jobId }); } catch {}
    const project = record(body.project);
    const settings = record(project.settings);
    const playbackSpeed = [1, 1.2, 1.4].includes(Number(settings.playbackSpeed)) ? Number(settings.playbackSpeed) : 1.2;
    const subtitleCleanupMode = String(settings.subtitleCleanupMode || "recreate-clean");
    const sourceAudioMode = String(settings.sourceAudioMode || "mute-korean-tts");
    const scenes = Array.isArray(body.scenes) ? body.scenes : [];
    const plan = buildPlan(project, scenes);
    if (!plan.length) throw new Error("합성할 승인 장면 영상이 없습니다.");
    const vertical = project.ratio === "720:1280";
    const width = vertical ? 720 : 1280;
    const height = vertical ? 1280 : 720;
    const plannedDuration = plan.reduce((sum, item) => sum + item.duration, 0);
    const totalDuration = Math.max(1, Math.min(Number(project.duration_seconds) || plannedDuration, plannedDuration));
    stage = "원본 파일 다운로드·컷 구간 생성";
    const sources = await mapWithConcurrency(plan, 2, async (planItem, index) => {
      const sourcePath = join(root, `source-${index}.mp4`);
      try {
        await download(planItem.url, sourcePath, "video");
      } catch (error) {
        if (planItem.kind !== "licensed" || !scenes.length) throw error;
        const fallback = scenes[index % scenes.length]?.video_url;
        if (!fallback) throw error;
        await download(fallback, sourcePath, "video");
      }
      const normalizedPath = join(root, `clip-${index}.mp4`);
      const subtitleCrop = subtitleCleanupMode === "safe-bottom-crop" && planItem.kind === "licensed"
        ? "crop=iw:trunc(ih*0.84/2)*2:0:0,"
        : "";
      const sourceStart = Math.max(0, Number(planItem.sourceStartSecond) || 0);
      const requestedTake = Math.max(planItem.duration, planItem.duration * playbackSpeed);
      const availableTake = Number(planItem.sourceLimitEndSecond) > sourceStart
        ? Math.max(.1, Number(planItem.sourceLimitEndSecond) - sourceStart)
        : requestedTake;
      const sourceTake = Math.min(requestedTake, availableTake);
      const seekArgs = sourceStart > 0 ? ["-ss", String(sourceStart)] : [];
      const videoFilter = `trim=duration=${sourceTake},setpts=(PTS-STARTPTS)/${playbackSpeed},${subtitleCrop}scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,tpad=stop_mode=clone:stop_duration=${planItem.duration},trim=duration=${planItem.duration},format=yuv420p`;
      await run("ffmpeg", ["-y", ...seekArgs, "-i", sourcePath, "-vf", videoFilter, "-an", "-t", String(planItem.duration), "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", normalizedPath], root);
      return normalizedPath;
    });
    stage = "타임라인 컷 연결";
    const concatPath = join(root, "concat.txt");
    await fs.writeFile(concatPath, sources.map((item) => `file '${item.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
    const joinedPath = join(root, "joined.mp4");
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", joinedPath], root);

    stage = "한국어 자막·음성·배경음악 합성";
    const commerce = record(settings.commercePackage);
    const cues = Array.isArray(commerce.subtitleCues) ? commerce.subtitleCues : [];
    const assPath = join(root, "subtitles.ass");
    await createAss(assPath, cues, width, height, String(settings.subtitleStyle || "bold-pop"));
    const outputPath = join(root, "final.mp4");
    const inputs = ["-i", joinedPath];
    const audioFilters = [];
    const audioLabels = [];
    if (settings.voiceAudioUrl && sourceAudioMode === "mute-korean-tts") {
      const voicePath = join(root, "voice.mp3");
      await download(settings.voiceAudioUrl, voicePath, "audio");
      inputs.push("-i", voicePath);
      audioFilters.push(`[${audioLabels.length + 1}:a]volume=1.0,apad=pad_dur=${totalDuration}[voice]`);
      audioLabels.push("[voice]");
    }
    const moodKey = String(settings.musicMood || project.music_mood || "modern-corporate").replace(/-/g, "_").toUpperCase();
    const bgmUrl = process.env[`VIDEO_BGM_${moodKey}_URL`];
    if (bgmUrl && moodKey !== "NONE") {
      const musicPath = join(root, "music.mp3");
      await download(bgmUrl, musicPath, "audio");
      inputs.push("-stream_loop", "-1", "-i", musicPath);
      audioFilters.push(`[${audioLabels.length + 1}:a]volume=0.10,apad=pad_dur=${totalDuration}[music]`);
      audioLabels.push("[music]");
    }
    if (!audioLabels.length) {
      inputs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
      audioLabels.push("[1:a]");
    }
    const mixedLabel = audioLabels.length > 1 ? "[mixed]" : audioLabels[0];
    if (audioLabels.length > 1) audioFilters.push(`${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=longest:normalize=0[mixed]`);
    const filter = [`[0:v]ass=${assPath.replace(/:/g, "\\:")}[video]`, ...audioFilters].join(";");
    await run("ffmpeg", ["-y", ...inputs, "-filter_complex", filter, "-map", "[video]", "-map", mixedLabel, "-t", String(totalDuration), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outputPath], root);
    stage = "완성 MP4 업로드";
    const finalVideoUrl = await uploadOutput(outputPath, project.id || jobId);
    await callback(body.callbackUrl, { status: "completed", jobId, finalVideoUrl });
  } catch (error) {
    const message = `${stage}: ${error instanceof Error ? error.message : String(error)}`;
    process.stderr.write(`[${jobId}] ${message}\n`);
    try { await callback(body.callbackUrl, { status: "failed", jobId, message }); } catch {}
  } finally {
    activeJobId = null;
    await fs.rm(root, { recursive: true, force: true });
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") return send(response, 200, { ok: true, service: "gy-nexus-video-worker", activeJobId, queuedJobs });
  if (request.method !== "POST" || request.url !== "/render") return send(response, 404, { success: false, message: "Not found" });
  if (!process.env.VIDEO_WORKER_SECRET || request.headers.authorization !== `Bearer ${process.env.VIDEO_WORKER_SECRET}`) return send(response, 401, { success: false, message: "인증 실패" });
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw new Error("렌더링 요청이 너무 큽니다.");
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    await safeHttpsUrl(body.callbackUrl, true);
    const jobId = randomUUID();
    queuedJobs += 1;
    queue = queue.then(() => renderJob(jobId, body)).catch(() => undefined);
    return send(response, 202, { success: true, jobId, status: "queued" });
  } catch (error) {
    return send(response, 400, { success: false, message: error instanceof Error ? error.message : "잘못된 요청" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`GY-NEXUS Video Worker listening on ${PORT}\n`);
});
