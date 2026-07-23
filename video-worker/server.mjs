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
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 600 * 1024 * 1024;
let queue = Promise.resolve();
let activeJobId = null;
let queuedJobs = 0;

function send(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
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
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error("내부 네트워크 주소는 사용할 수 없습니다.");
  }
  return parsed;
}

async function download(url, destination, expectedKind = "video", maxBytes = MAX_DOWNLOAD_BYTES) {
  const parsed = await safeHttpsUrl(url);
  const response = await fetch(parsed, { redirect: "follow", signal: AbortSignal.timeout(120000) });
  if (!response.ok || !response.body) throw new Error(`소재 다운로드 실패: ${response.status}`);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (expectedKind === "video" && !contentType.startsWith("video/") && !contentType.includes("octet-stream")) throw new Error("직접 재생 가능한 영상 파일 주소가 아닙니다.");
  if (expectedKind === "audio" && !contentType.startsWith("audio/") && !contentType.includes("octet-stream")) throw new Error("직접 재생 가능한 음원 파일 주소가 아닙니다.");
  const announced = Number(response.headers.get("content-length") || 0);
  if (announced > maxBytes) throw new Error(`소재 파일이 ${Math.round(maxBytes / 1024 / 1024)}MB를 초과합니다.`);
  let received = 0;
  const guarded = Readable.fromWeb(response.body).map((chunk) => {
    received += chunk.length;
    if (received > maxBytes) throw new Error(`소재 파일이 ${Math.round(maxBytes / 1024 / 1024)}MB를 초과합니다.`);
    return chunk;
  });
  await pipeline(guarded, createWriteStream(destination));
  return { contentType: contentType.split(";")[0] || "application/octet-stream", bytes: received };
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let errorText = "";
    child.stderr.on("data", (chunk) => { errorText = `${errorText}${chunk}`.slice(-20000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} 실패 (${code}): ${errorText.slice(-5000)}`)));
  });
}

function runCapture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let errorText = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { errorText = `${errorText}${chunk}`.slice(-20000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`${command} 실패 (${code}): ${errorText.slice(-5000)}`)));
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
  const fontSize = Math.round(height * (style === "minimal" ? 0.034 : 0.044));
  const outline = style === "minimal" ? 2 : 5;
  const body = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: GY,Noto Sans CJK KR,${fontSize},&H00FFFFFF,&H000000FF,&HCC000000,&H70000000,-1,0,0,0,100,100,0,0,1,${outline},1,2,55,55,${Math.round(height * 0.1)},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${cues.map((cue) => `Dialogue: 0,${assTime(cue.startSecond)},${assTime(cue.endSecond)},GY,,0,0,0,,${assText(cue.text)}`).join("\n")}\n`;
  await fs.writeFile(path, body, "utf8");
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
  const references = Array.isArray(settings.licensedFinalAssets) ? settings.licensedFinalAssets : [];
  const generated = scenes.filter((scene) => scene.video_url).map((scene) => ({
    url: scene.video_url,
    duration: Math.max(0.7, Math.min(5, Number(scene.end_second) - Number(scene.start_second) || 5)),
    kind: "generated",
    sourceStartSecond: 0,
    sourceLimitEndSecond: null,
  }));
  const referenceMap = new Map(references.filter((item) => item && item.assetKind === "video-file" && item.useInFinal && item.rightsStatus !== "unverified").map((item) => [item.id, item]));
  const sourceMix = record(settings.sourceMixPlan);
  if (Array.isArray(sourceMix.cuts) && sourceMix.cuts.length) {
    let generatedIndex = 0;
    return sourceMix.cuts.map((shot) => {
      const maximumCutDuration = shot.decision === "use-licensed" ? 2.5 : 5;
      const duration = Math.max(0.7, Math.min(maximumCutDuration, Number(shot.durationSeconds) || 1.5));
      const reference = referenceMap.get(String(shot.referenceId || ""));
      if (shot.decision === "use-licensed" && reference?.url) {
        return {
          url: reference.url,
          duration,
          kind: "licensed",
          sourceStartSecond: Math.max(Number(reference.trimStartSecond) || 0, Number(shot.sourceStartSecond) || 0),
          sourceLimitEndSecond: Number(reference.trimEndSecond || reference.durationSeconds) || null,
        };
      }
      const source = generated[generatedIndex % Math.max(1, generated.length)];
      generatedIndex += 1;
      return source ? { ...source, duration } : null;
    }).filter(Boolean);
  }
  return generated;
}

async function uploadFile(filePath, objectPath, contentType) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const bucket = String(process.env.CREATIVE_STORAGE_BUCKET || "creative-assets");
  if (!supabaseUrl || !serviceKey) throw new Error("Worker의 Supabase 환경변수가 없습니다.");
  const data = await fs.readFile(filePath);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": contentType, "x-upsert": "true" },
    body: data,
  });
  if (!response.ok) throw new Error(`파일 업로드 실패: ${response.status} ${await response.text()}`);
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
}

async function uploadOutput(filePath, projectId) {
  const objectPath = `videos/${new Date().toISOString().slice(0, 10)}/${Date.now()}-gy-shopping-shorts-${String(projectId).replace(/[^a-z0-9-]/gi, "").slice(0, 40)}.mp4`;
  return uploadFile(filePath, objectPath, "video/mp4");
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

async function extractFramesJob(workerJobId, body) {
  const root = await fs.mkdtemp(join(tmpdir(), `gy-scene-${workerJobId}-`));
  activeJobId = workerJobId;
  queuedJobs = Math.max(0, queuedJobs - 1);
  const allowed = new Set(["owned", "seller-provided", "affiliate-provided", "permission-confirmed"]);
  try {
    if (!allowed.has(String(body.rightsStatus || ""))) throw new Error("권리 확인된 영상만 프레임을 추출할 수 있습니다.");
    const sourcePath = join(root, "source-video");
    await download(body.videoUrl, sourcePath, "video", 150 * 1024 * 1024);
    const normalizedPath = join(root, "normalized.mp4");
    await run("ffmpeg", ["-y", "-i", sourcePath, "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", normalizedPath], root);
    const stat = await fs.stat(normalizedPath);
    const durationRaw = await runCapture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", normalizedPath], root);
    const duration = Math.max(0.1, Number(durationRaw) || 0);
    if (!duration) throw new Error("영상 길이를 확인하지 못했습니다.");
    const sampleCount = Math.min(12, Math.max(6, Math.round(Number(body.sampleCount) || 12)));
    const timestamps = Array.from({ length: sampleCount }, (_, index) => Number((((index + 1) / (sampleCount + 1)) * duration).toFixed(3)));
    const date = new Date().toISOString().slice(0, 10);
    const cleanId = String(body.candidateId || body.jobId || workerJobId).replace(/[^a-z0-9-]/gi, "").slice(0, 48) || workerJobId;
    const stagedPath = `references/${date}/${Date.now()}-phase2-scene-${cleanId}.mp4`;
    const stagedVideoUrl = await uploadFile(normalizedPath, stagedPath, "video/mp4");
    const frameUrls = [];
    for (let index = 0; index < timestamps.length; index += 1) {
      const framePath = join(root, `frame-${String(index + 1).padStart(2, "0")}.jpg`);
      await run("ffmpeg", ["-y", "-ss", String(timestamps[index]), "-i", normalizedPath, "-frames:v", "1", "-vf", "scale=960:-2:force_original_aspect_ratio=decrease", "-q:v", "2", framePath], root);
      const objectPath = `references/${date}/${Date.now()}-phase2-frame-${cleanId}-${String(index + 1).padStart(2, "0")}.jpg`;
      frameUrls.push(await uploadFile(framePath, objectPath, "image/jpeg"));
    }
    await callback(body.callbackUrl, { status: "completed", jobId: body.jobId, workerJobId, stagedVideoUrl, frameUrls, frameTimestamps: timestamps, durationSeconds: Number(duration.toFixed(3)), sourceBytes: stat.size, mimeType: "video/mp4" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try { await callback(body.callbackUrl, { status: "failed", jobId: body.jobId, workerJobId, message }); } catch {}
  } finally {
    activeJobId = null;
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function addAudioInput({ inputs, filters, root, url, fileName, inputIndex, loop = false, maxBytes = 60 * 1024 * 1024 }) {
  const path = join(root, fileName);
  await download(url, path, "audio", maxBytes);
  if (loop) inputs.push("-stream_loop", "-1");
  inputs.push("-i", path);
  return inputIndex;
}

async function buildAudioGraph({ settings, project, root, totalDuration, inputs }) {
  const timeline = record(settings.audioTimeline);
  const voiceSegments = Array.isArray(timeline.voiceSegments) ? timeline.voiceSegments.map(record).filter((segment) => String(segment.audioUrl || "").startsWith("https://")) : [];
  const filters = [];
  const mixLabels = [];
  let inputIndex = 1;
  let voiceLabel = "";
  const voiceMasterVolume = clamp(timeline.voiceMasterVolume, 0, 2, 1);

  if (voiceSegments.length) {
    const segmentLabels = [];
    for (let index = 0; index < voiceSegments.length; index += 1) {
      const segment = voiceSegments[index];
      const url = String(segment.audioUrl);
      await addAudioInput({ inputs, filters, root, url, fileName: `voice-segment-${index}`, inputIndex });
      const startSecond = clamp(segment.startSecond, 0, totalDuration, 0);
      const endSecond = clamp(segment.endSecond, startSecond + 0.2, totalDuration, startSecond + 2);
      const slot = Math.max(0.2, endSecond - startSecond);
      const speed = clamp(segment.speed, 0.75, 1.35, 1);
      const volume = clamp(segment.volume, 0, 2, 1) * voiceMasterVolume;
      const delay = Math.round(startSecond * 1000);
      const label = `vseg${index}`;
      filters.push(`[${inputIndex}:a]aresample=44100,atrim=0:${(slot * speed).toFixed(3)},atempo=${speed.toFixed(3)},atrim=0:${slot.toFixed(3)},volume=${volume.toFixed(3)},adelay=${delay}|${delay},apad=pad_dur=${totalDuration.toFixed(3)},atrim=0:${totalDuration.toFixed(3)}[${label}]`);
      segmentLabels.push(`[${label}]`);
      inputIndex += 1;
    }
    voiceLabel = "voicebus";
    filters.push(`${segmentLabels.join("")}amix=inputs=${segmentLabels.length}:duration=longest:normalize=0,alimiter=limit=0.95,atrim=0:${totalDuration.toFixed(3)}[${voiceLabel}]`);
  } else if (String(settings.voiceAudioUrl || "").startsWith("https://") && String(settings.sourceAudioMode || "mute-korean-tts") === "mute-korean-tts") {
    await addAudioInput({ inputs, filters, root, url: String(settings.voiceAudioUrl), fileName: "voice-audio", inputIndex });
    voiceLabel = "voicebus";
    filters.push(`[${inputIndex}:a]aresample=44100,volume=${voiceMasterVolume.toFixed(3)},apad=pad_dur=${totalDuration.toFixed(3)},atrim=0:${totalDuration.toFixed(3)}[${voiceLabel}]`);
    inputIndex += 1;
  }

  const music = record(timeline.music);
  const moodKey = String(settings.musicMood || project.music_mood || "modern-corporate").replace(/-/g, "_").toUpperCase();
  const musicUrl = String(music.url || process.env[`VIDEO_BGM_${moodKey}_URL`] || "");
  let musicLabel = "";
  if (musicUrl.startsWith("https://") && moodKey !== "NONE") {
    await addAudioInput({ inputs, filters, root, url: musicUrl, fileName: "music-audio", inputIndex, loop: music.loop !== false });
    const startSecond = clamp(music.startSecond, 0, totalDuration, 0);
    const musicDuration = Math.max(0.2, totalDuration - startSecond);
    const volume = clamp(music.volume ?? settings.musicVolume, 0, 1, 0.16);
    const fadeIn = Math.min(clamp(music.fadeIn, 0, 10, 0.5), musicDuration / 2);
    const fadeOut = Math.min(clamp(music.fadeOut, 0, 10, 1.2), musicDuration / 2);
    const fadeOutStart = Math.max(0, musicDuration - fadeOut);
    const delay = Math.round(startSecond * 1000);
    musicLabel = "musicbus";
    filters.push(`[${inputIndex}:a]aresample=44100,atrim=0:${musicDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${volume.toFixed(3)},afade=t=in:st=0:d=${fadeIn.toFixed(3)},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut.toFixed(3)},adelay=${delay}|${delay},apad=pad_dur=${totalDuration.toFixed(3)},atrim=0:${totalDuration.toFixed(3)}[${musicLabel}]`);
    inputIndex += 1;
  }

  if (voiceLabel && musicLabel && music.autoDuck !== false) {
    filters.push(`[${voiceLabel}]asplit=2[voiceout][voiceside]`);
    filters.push(`[${musicLabel}][voiceside]sidechaincompress=threshold=0.025:ratio=10:attack=15:release=350[musicduck]`);
    mixLabels.push("[voiceout]", "[musicduck]");
  } else {
    if (voiceLabel) mixLabels.push(`[${voiceLabel}]`);
    if (musicLabel) mixLabels.push(`[${musicLabel}]`);
  }

  const sfxCues = Array.isArray(timeline.sfxCues) ? timeline.sfxCues.map(record).filter((cue) => String(cue.url || "").startsWith("https://")).slice(0, 24) : [];
  for (let index = 0; index < sfxCues.length; index += 1) {
    const cue = sfxCues[index];
    await addAudioInput({ inputs, filters, root, url: String(cue.url), fileName: `sfx-${index}`, inputIndex, maxBytes: 20 * 1024 * 1024 });
    const startSecond = clamp(cue.startSecond, 0, totalDuration, 0);
    const duration = Math.min(clamp(cue.durationSeconds, 0.1, 10, 2), Math.max(0.1, totalDuration - startSecond));
    const volume = clamp(cue.volume, 0, 2, 0.7);
    const delay = Math.round(startSecond * 1000);
    const label = `sfx${index}`;
    filters.push(`[${inputIndex}:a]aresample=44100,atrim=0:${duration.toFixed(3)},volume=${volume.toFixed(3)},adelay=${delay}|${delay},apad=pad_dur=${totalDuration.toFixed(3)},atrim=0:${totalDuration.toFixed(3)}[${label}]`);
    mixLabels.push(`[${label}]`);
    inputIndex += 1;
  }

  if (!mixLabels.length) {
    inputs.push("-f", "lavfi", "-i", `anullsrc=channel_layout=stereo:sample_rate=44100:d=${totalDuration.toFixed(3)}`);
    mixLabels.push(`[${inputIndex}:a]`);
  }

  if (mixLabels.length === 1) {
    filters.push(`${mixLabels[0]}alimiter=limit=0.95,atrim=0:${totalDuration.toFixed(3)}[finalaudio]`);
  } else {
    filters.push(`${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:normalize=0,alimiter=limit=0.95,atrim=0:${totalDuration.toFixed(3)}[finalaudio]`);
  }
  return { filters, audioLabel: "[finalaudio]" };
}

async function renderJob(jobId, body) {
  const root = await fs.mkdtemp(join(tmpdir(), `gy-shopping-${jobId}-`));
  let stage = "작업 준비";
  activeJobId = jobId;
  queuedJobs = Math.max(0, queuedJobs - 1);
  try {
    try { await callback(body.callbackUrl, { status: "rendering", jobId }); } catch {}
    const project = record(body.project);
    const settings = record(project.settings);
    const playbackSpeed = [1, 1.2, 1.4].includes(Number(settings.playbackSpeed)) ? Number(settings.playbackSpeed) : 1;
    const subtitleCleanupMode = String(settings.subtitleCleanupMode || "safe-bottom-crop");
    const scenes = Array.isArray(body.scenes) ? body.scenes : [];
    const plan = buildPlan(project, scenes);
    if (!plan.length) throw new Error("합성할 직접 촬영·허가 영상이 없습니다.");
    const vertical = project.ratio === "720:1280";
    const width = vertical ? 720 : 1280;
    const height = vertical ? 1280 : 720;
    const plannedDuration = plan.reduce((sum, item) => sum + item.duration, 0);
    const totalDuration = Math.max(1, Math.min(Number(project.duration_seconds) || plannedDuration, plannedDuration));

    stage = "원본 파일 다운로드·컷 구간 생성";
    const sources = await mapWithConcurrency(plan, 2, async (planItem, index) => {
      const sourcePath = join(root, `source-${index}.bin`);
      await download(planItem.url, sourcePath, "video");
      const normalizedPath = join(root, `clip-${index}.mp4`);
      const sourceStart = Math.max(0, Number(planItem.sourceStartSecond) || 0);
      const requestedTake = Math.max(planItem.duration, planItem.duration * playbackSpeed);
      const availableTake = Number(planItem.sourceLimitEndSecond) > sourceStart
        ? Math.max(0.1, Number(planItem.sourceLimitEndSecond) - sourceStart)
        : requestedTake;
      const sourceTake = Math.min(requestedTake, availableTake);
      const cleanup = subtitleCleanupMode === "safe-bottom-crop" && planItem.kind === "licensed"
        ? "crop=iw:trunc(ih*0.84/2)*2:0:0,"
        : "";
      const videoFilter = `${cleanup}scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,setpts=PTS/${playbackSpeed}`;
      const seekArgs = sourceStart > 0 ? ["-ss", String(sourceStart)] : [];
      await run("ffmpeg", ["-y", ...seekArgs, "-i", sourcePath, "-t", String(sourceTake), "-vf", videoFilter, "-an", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", normalizedPath], root);
      return normalizedPath;
    });

    stage = "타임라인 컷 연결";
    const concatPath = join(root, "concat.txt");
    await fs.writeFile(concatPath, sources.map((item) => `file '${item.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
    const joinedPath = join(root, "joined.mp4");
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", joinedPath], root);

    stage = "한국어 자막·문장별 음성·음악·효과음 합성";
    const commerce = record(settings.commercePackage);
    const cues = Array.isArray(commerce.subtitleCues) ? commerce.subtitleCues : [];
    const assPath = join(root, "subtitles.ass");
    await createAss(assPath, cues, width, height, String(settings.subtitleStyle || "bold-pop"));
    const outputPath = join(root, "final.mp4");
    const inputs = ["-i", joinedPath];
    const audio = await buildAudioGraph({ settings, project, root, totalDuration, inputs });
    const escapedAss = assPath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    const filters = [`[0:v]ass='${escapedAss}'[video]`, ...audio.filters].join(";");
    await run("ffmpeg", ["-y", ...inputs, "-filter_complex", filters, "-map", "[video]", "-map", audio.audioLabel, "-t", String(totalDuration), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outputPath], root);

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
  if (request.method === "GET" && request.url === "/health") {
    return send(response, 200, { ok: true, service: "gy-nexus-video-worker", version: "phase2-audio-timeline-2.0.0", activeJobId, queuedJobs });
  }
  if (request.method !== "POST" || !["/render", "/extract-frames"].includes(request.url || "")) {
    return send(response, 404, { success: false, message: "Not found" });
  }
  if (!process.env.VIDEO_WORKER_SECRET || request.headers.authorization !== `Bearer ${process.env.VIDEO_WORKER_SECRET}`) {
    return send(response, 401, { success: false, message: "인증 실패" });
  }
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw new Error("요청이 너무 큽니다.");
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    await safeHttpsUrl(body.callbackUrl, true);
    const workerJobId = randomUUID();
    queuedJobs += 1;
    if (request.url === "/extract-frames") queue = queue.then(() => extractFramesJob(workerJobId, body)).catch(() => undefined);
    else queue = queue.then(() => renderJob(workerJobId, body)).catch(() => undefined);
    return send(response, 202, { success: true, jobId: workerJobId, status: "queued" });
  } catch (error) {
    return send(response, 400, { success: false, message: error instanceof Error ? error.message : "잘못된 요청" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`GY-NEXUS Shopping Shorts Worker listening on ${PORT}\n`);
});
