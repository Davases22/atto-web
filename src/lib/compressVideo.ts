// Client-side video compression with ffmpeg.wasm.
//
// Why client-side: the ad video is uploaded browser → Cloudinary direct
// (see src/app/admin/ads/page.tsx). Cloudinary's free plan rejects videos
// over 100 MB and a single large POST can time out, which used to fail
// silently. Re-encoding to a smaller H.264 file here keeps the bytes on the
// wire small so the upload actually succeeds.
//
// Why everything loads from CDN via toBlobURL: it sidesteps Turbopack's
// worker/wasm resolution entirely — the FFmpeg class worker, the core JS and
// the wasm binary are all fetched as blob URLs at runtime. We pin the exact
// versions so the URLs stay stable. The single-thread core is used on
// purpose: it does NOT need SharedArrayBuffer, so no COOP/COEP headers are
// required on the app.

import type { FFmpeg } from "@ffmpeg/ffmpeg";

// Pinned to the installed @ffmpeg/ffmpeg (0.12.15). The UMD worker file name
// is content-hashed per release, so this must match the installed version —
// bump both together when upgrading the package.
const FFMPEG_VERSION = "0.12.15";
const FFMPEG_WORKER_URL = `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/umd/814.ffmpeg.js`;

// Single-thread core (no SharedArrayBuffer requirement).
const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let ffmpegPromise: Promise<FFmpeg> | null = null;

// Load (and cache) a ready FFmpeg instance. Subsequent calls reuse the same
// loaded wasm so a second upload in the same session is instant to start.
async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegPromise) return ffmpegPromise;
  ffmpegPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      classWorkerURL: await toBlobURL(FFMPEG_WORKER_URL, "text/javascript"),
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });
    return ffmpeg;
  })();
  // If loading fails, clear the cache so a later attempt can retry instead of
  // resolving the same rejected promise forever.
  ffmpegPromise.catch(() => {
    ffmpegPromise = null;
  });
  return ffmpegPromise;
}

export interface CompressResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
}

/**
 * Re-encode a video to a smaller H.264 MP4.
 *
 * - Caps height at 1280px (e.g. a 1080×1920 phone clip → 720×1280), width
 *   kept proportional and even (`-2`).
 * - CRF 28 + `veryfast` preset: a strong size cut with acceptable quality
 *   for short feed ads.
 * - AAC 128k audio, `+faststart` so the moov atom is at the front (lets the
 *   app start playback before the whole file is buffered).
 *
 * @param onProgress called with 0..1 as encoding proceeds (best-effort).
 * @throws if ffmpeg fails to load or the encode errors — callers should
 *   decide whether to fall back to the original file.
 */
export async function compressVideo(
  file: File,
  onProgress?: (ratio: number) => void
): Promise<CompressResult> {
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  const onProgressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(Math.min(Math.max(progress, 0), 1));
  };
  ffmpeg.on("progress", onProgressHandler);

  const inputName = "input";
  const outputName = "output.mp4";

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec([
      "-i",
      inputName,
      "-vf",
      "scale=-2:'min(1280,ih)'",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputName,
    ]);
    const data = await ffmpeg.readFile(outputName);
    // data is a Uint8Array; copy its bytes into a plain ArrayBuffer-backed
    // Blob (ffmpeg may hand back a SharedArrayBuffer view, which isn't a valid
    // BlobPart under the current TS lib types).
    const u8 = data as Uint8Array;
    const ab = u8.buffer.slice(
      u8.byteOffset,
      u8.byteOffset + u8.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([ab], { type: "video/mp4" });
    const compressed = new File([blob], renameToMp4(file.name), {
      type: "video/mp4",
    });
    return {
      file: compressed,
      originalBytes: file.size,
      compressedBytes: compressed.size,
    };
  } finally {
    ffmpeg.off("progress", onProgressHandler);
    // Best-effort cleanup of the virtual FS so repeated uploads don't pile up.
    ffmpeg.deleteFile(inputName).catch(() => {});
    ffmpeg.deleteFile(outputName).catch(() => {});
  }
}

function renameToMp4(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "video"}.mp4`;
}
