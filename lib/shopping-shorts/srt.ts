import type { ShoppingShortsScene } from "./types";

function timestamp(seconds: number) {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function scenesToSrt(scenes: ShoppingShortsScene[]) {
  return scenes
    .map((scene, index) => [
      String(index + 1),
      `${timestamp(scene.start)} --> ${timestamp(scene.end)}`,
      scene.subtitle.replace(/\s+/g, " ").trim(),
      "",
    ].join("\n"))
    .join("\n");
}

export function scenesToPlainSubtitles(scenes: ShoppingShortsScene[]) {
  return scenes.map((scene) => scene.subtitle.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

