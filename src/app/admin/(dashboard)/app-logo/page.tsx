"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";

interface AppLogo {
  imageUrl: string;
  /** Launch splash image of its own; absent means the splash follows imageUrl. */
  splashImageUrl?: string | null;
  minVersion: number | null;
  fallbackImageUrl: string | null;
  updatedAt: string;
}

const DEFAULT_LOGO_URL =
  "https://res.cloudinary.com/da9vymoah/image/upload/v1774905442/Property_1_Default_zqv4qr.png";

// First app build that supports version targeted logos (sends its build number
// and hides the app drawn "SOUND"). Earlier builds never receive a logo, so a
// baked in wordmark can never double up on them.
const MIN_SUPPORTED_BUILD = 179;

const MAX_WIDTH = 1024;
const HARD_LIMIT = 5 * 1024 * 1024;

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = bitmap.width > MAX_WIDTH ? MAX_WIDTH / bitmap.width : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "logo";
    return new File([blob], `${base}.png`, { type: "image/png" });
  } catch {
    return file;
  }
}

/** Pick + compress a single image; returns file + object URL, or null. */
function useImagePick() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tooLarge, setTooLarge] = useState(false);
  const pick = async (raw: File | undefined) => {
    setFile(null);
    setPreview(null);
    setTooLarge(false);
    if (!raw) return;
    setBusy(true);
    try {
      const c = await compressImage(raw);
      setFile(c);
      setPreview(URL.createObjectURL(c));
      setTooLarge(c.size > HARD_LIMIT);
    } finally {
      setBusy(false);
    }
  };
  return { file, preview, busy, tooLarge, pick, reset: () => pick(undefined) };
}

export default function AdminAppLogoPage() {
  const [logo, setLogo] = useState<AppLogo | null>(null);
  // Highest build the backend has actually seen in the wild (from the app's own
  // appBuild). Drives the "latest build" hint so it never goes stale, and
  // MIN_SUPPORTED_BUILD is only the floor for when nothing has been seen yet.
  const [latestSeenBuild, setLatestSeenBuild] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const primary = useImagePick();
  const fallback = useImagePick();
  const splash = useImagePick();
  const splashFileRef = useRef<HTMLInputElement>(null);
  const [splashBusy, setSplashBusy] = useState(false);
  const [splashError, setSplashError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fbRef = useRef<HTMLInputElement>(null);

  // Modal wizard state
  const [modalOpen, setModalOpen] = useState(false);
  const [audience, setAudience] = useState<"all" | "specific">("all");
  const [minVersion, setMinVersion] = useState<string>(String(MIN_SUPPORTED_BUILD));
  const [othersSee, setOthersSee] = useState<"current" | "custom">("current");

  const fetchLogo = useCallback(async () => {
    try {
      const res = await fetch("/api/app-logo");
      const data = await res.json();
      setLogo(data.logo ?? null);
      setLatestSeenBuild(
        typeof data.latestSeenBuild === "number" ? data.latestSeenBuild : null
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogo();
  }, [fetchLogo]);

  // Real newest build to target: what we have seen in the wild, else the floor.
  const latestBuild = latestSeenBuild ?? MIN_SUPPORTED_BUILD;

  const startConfigure = () => {
    setError(null);
    setNotice(null);
    if (!primary.file) {
      setError("Pick a logo image first (transparent PNG recommended).");
      return;
    }
    if (primary.tooLarge) {
      setError(`That image is ${fmt(primary.file.size)}. Please compress it and choose it again.`);
      return;
    }
    setAudience("all");
    setMinVersion(String(latestBuild));
    setOthersSee("current");
    fallback.reset();
    setModalOpen(true);
  };

  const confirm = async () => {
    if (!primary.file) return;
    if (audience === "specific" && othersSee === "custom" && !fallback.file) {
      setError("Pick the logo for older versions, or choose 'The current logo'.");
      return;
    }
    if (fallback.tooLarge) {
      setError("The older versions logo is too large. Compress it and choose it again.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", primary.file);
      if (audience === "specific") {
        fd.append("minVersion", minVersion || String(MIN_SUPPORTED_BUILD));
        if (othersSee === "custom" && fallback.file) fd.append("fallbackFile", fallback.file);
      }
      const res = await fetch("/api/app-logo", { method: "POST", body: fd });
      if (res.ok) {
        setModalOpen(false);
        primary.reset();
        fallback.reset();
        if (fileRef.current) fileRef.current.value = "";
        if (fbRef.current) fbRef.current.value = "";
        setNotice("Logo saved. It appears in the app within one refresh.");
        await fetchLogo();
      } else {
        const b = await res.json().catch(() => ({}));
        setError(b.error || `Save failed (${res.status})`);
      }
    } catch {
      setError("Save failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  // What each version segment sees right now.
  type Segment = { label: string; img: string; note?: string };
  const segments: Segment[] = !logo
    ? [
        {
          label: "All versions",
          img: DEFAULT_LOGO_URL,
          note: "Bundled default; no custom logo set yet.",
        },
      ]
    : logo.minVersion
      ? [
          { label: `Build ${logo.minVersion} and up`, img: logo.imageUrl },
          {
            label: `Older builds (below ${logo.minVersion})`,
            img: logo.fallbackImageUrl || DEFAULT_LOGO_URL,
            note: logo.fallbackImageUrl ? "Fallback logo" : "Built in default",
          },
        ]
      : [{ label: "All up to date builds", img: logo.imageUrl }];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="App logo"
        description="Main app logo, the feed header wordmark."
      />

      <div>
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-neutral-400">
            What each version sees right now
          </h2>
          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 p-8">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
            </div>
          ) : (
            <div
              className={`grid gap-3 ${
                segments.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {segments.map((seg) => (
                <div
                  key={seg.label}
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-4"
                >
                  <p className="mb-3 text-xs font-semibold text-white">{seg.label}</p>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">
                    Feed header
                  </p>
                  <div className="flex h-24 items-center justify-center rounded-lg bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={seg.img}
                      alt={seg.label}
                      className="max-h-20 max-w-full object-contain"
                    />
                  </div>
                  <p className="mb-1 mt-3 text-[10px] uppercase tracking-wide text-neutral-600">
                    Launch splash
                  </p>
                  <div className="flex h-36 items-center justify-center rounded-lg bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo?.splashImageUrl || seg.img}
                      alt={`${seg.label} splash`}
                      className={
                        logo?.splashImageUrl
                          ? "max-h-24 max-w-[50%] object-contain"
                          : "max-h-12 max-w-[60%] object-contain"
                      }
                    />
                  </div>
                  {seg.note && (
                    <p className="mt-2 text-xs text-neutral-600">{seg.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="mb-1 text-sm font-semibold">Upload a new logo</h2>
          <p className="mb-4 text-xs text-neutral-500">
            This logo is used in the feed header, and in the launch splash too
            unless you set a splash logo below. Include the full wordmark
            (ATTO and SOUND) in the image: with a custom logo the app no longer
            draws SOUND underneath. Transparent PNG,
            recommended around 1024 by 360 px (wide, about 2.85 to 1). The app
            shows it at that ratio, so matching it keeps the header size right.
            We resize it in your browser before upload.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            onChange={(e) => primary.pick(e.target.files?.[0])}
            className="block w-full text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-neutral-200"
          />

          {primary.busy && (
            <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing image…
            </p>
          )}
          {primary.preview && (
            <div className="mt-4 flex items-center justify-center rounded-lg border border-neutral-800 bg-black p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={primary.preview} alt="Preview" className="max-h-20 max-w-full object-contain" />
            </div>
          )}

          {notice && !error && !modalOpen && (
            <p className="mt-3 text-xs text-neutral-500">{notice}</p>
          )}
          {error && !modalOpen && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={startConfigure}
            disabled={primary.busy || !primary.file || primary.tooLarge}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" /> Continue
          </button>
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="mb-1 text-sm font-semibold">Launch splash logo</h2>
          <p className="mb-4 text-xs text-neutral-500">
            Optional. The image shown alone on black while the app opens, for
            example the round mark from the website. Any shape works: the app
            sizes it from the image. Leave it empty and the splash uses the
            logo above. A change shows from the second launch after the app
            has refreshed it.
          </p>

          <div className="mb-4 flex h-40 items-center justify-center rounded-lg bg-black">
            {logo?.splashImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.splashImageUrl} alt="Current splash" className="max-h-32 max-w-[60%] object-contain" />
            ) : (
              <span className="text-xs text-neutral-600">Following the main logo</span>
            )}
          </div>

          <input
            ref={splashFileRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            onChange={(e) => splash.pick(e.target.files?.[0])}
            className="block w-full text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
          />
          {splash.preview && (
            <div className="mt-4 flex items-center justify-center rounded-lg border border-neutral-800 bg-black p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={splash.preview} alt="Splash preview" className="max-h-32 max-w-[60%] object-contain" />
            </div>
          )}
          {splashError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{splashError}</span>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              disabled={!splash.file || splash.tooLarge || splashBusy}
              onClick={async () => {
                if (!splash.file) return;
                setSplashBusy(true);
                setSplashError(null);
                try {
                  const body = new FormData();
                  body.append("file", splash.file);
                  const res = await fetch("/api/app-logo/splash", { method: "POST", body });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data.error ?? "Upload failed");
                  splash.reset();
                  if (splashFileRef.current) splashFileRef.current.value = "";
                  await fetchLogo();
                } catch (err) {
                  setSplashError(err instanceof Error ? err.message : "Upload failed");
                } finally {
                  setSplashBusy(false);
                }
              }}
              className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              {splashBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Set splash logo
            </button>
            {logo?.splashImageUrl && (
              <button
                disabled={splashBusy}
                onClick={async () => {
                  setSplashBusy(true);
                  setSplashError(null);
                  try {
                    const res = await fetch("/api/app-logo/splash", { method: "DELETE" });
                    if (!res.ok) throw new Error("Could not remove the splash logo");
                    await fetchLogo();
                  } catch (err) {
                    setSplashError(err instanceof Error ? err.message : "Request failed");
                  } finally {
                    setSplashBusy(false);
                  }
                }}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 disabled:opacity-40"
              >
                Use the main logo instead
              </button>
            )}
          </div>
        </section>
      </div>

      {/* ── Modal wizard ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <h3 className="text-base font-semibold">Who sees this logo?</h3>

            <div className="mt-4 space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 p-3">
                <input type="radio" checked={audience === "all"} onChange={() => setAudience("all")} />
                <span className="text-sm">Everyone (all up to date apps)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 p-3">
                <input
                  type="radio"
                  checked={audience === "specific"}
                  onChange={() => setAudience("specific")}
                />
                <span className="text-sm">Only a specific version and up</span>
              </label>
            </div>

            {audience === "specific" && (
              <div className="mt-4">
                <label className="text-xs text-neutral-400">Minimum app build number</label>
                <input
                  type="number"
                  value={minVersion}
                  onChange={(e) => setMinVersion(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm text-white"
                />
                <p className="mt-1 text-xs text-neutral-600">
                  {latestSeenBuild
                    ? `Latest build seen is ${latestBuild}.`
                    : `No build seen yet; using ${latestBuild} as the floor.`}{" "}
                  Builds below your number cannot show a SOUND logo safely; they
                  see the choice below.
                </p>

                <h4 className="mt-5 text-sm font-semibold">What should older versions see?</h4>
                <div className="mt-3 space-y-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 p-3">
                    <input
                      type="radio"
                      checked={othersSee === "current"}
                      onChange={() => setOthersSee("current")}
                    />
                    <span className="text-sm">The current logo</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 p-3">
                    <input
                      type="radio"
                      checked={othersSee === "custom"}
                      onChange={() => setOthersSee("custom")}
                    />
                    <span className="text-sm">A different logo</span>
                  </label>
                </div>

                {othersSee === "custom" && (
                  <div className="mt-3">
                    <input
                      ref={fbRef}
                      type="file"
                      accept="image/png,image/webp,image/jpeg"
                      onChange={(e) => fallback.pick(e.target.files?.[0])}
                      className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
                    />
                    {fallback.preview && (
                      <div className="mt-3 flex items-center justify-center rounded-lg border border-neutral-800 bg-black p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fallback.preview} alt="Fallback preview" className="max-h-14 object-contain" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && modalOpen && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                disabled={uploading}
                className="rounded-lg px-4 py-2 text-sm text-neutral-300 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={uploading || fallback.busy}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save logo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
