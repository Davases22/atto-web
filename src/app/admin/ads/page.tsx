"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ImageIcon, Loader2, Trash2, Upload, GripVertical } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Ad {
  id: string;
  video_url: string;
  brand_name: string;
  brand_avatar: string | null; // Cloudinary public_id, NOT a full URL
  caption: string;
  sort_order: number;
  active: boolean;
}

// Cloud name comes from env (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME), so it
// always matches whatever CLOUDINARY_CLOUD_NAME the server-side upload
// routes use. Fallback covers `next dev` without .env.local set.
const CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "da9vymoah";

/**
 * Build a thumbnail URL from a Cloudinary video URL.
 * `so_0` = poster frame at 0s, `c_fill` crops to portrait 120×180, `q_auto`
 * lets Cloudinary pick the right quality. We swap the file extension to
 * `.jpg` so Cloudinary serves an image, not a video.
 */
function videoThumb(videoUrl: string): string {
  if (!videoUrl.includes("/video/upload/")) return videoUrl;
  return videoUrl
    .replace("/video/upload/", "/video/upload/so_0,c_fill,w_120,h_180,q_auto/")
    .replace(/\.(mp4|mov|webm|m4v)(\?.*)?$/i, ".jpg$2");
}

/**
 * Build an admin-side preview URL from a stored brand-avatar public_id.
 * The mobile app uses a heavier transform with a black border (see
 * useAds.ts in atto-app/front); here we use a lighter pad for the list.
 */
function avatarPreview(publicId: string | null): string | null {
  if (!publicId) return null;
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_lpad,w_80,h_80,b_rgb:000000,f_png/${publicId}`;
}

export default function AdminAdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [caption, setCaption] = useState("");

  // Brand avatar for the create form: kept separate so the user can pick the
  // avatar before the video upload starts (the avatar upload is a cheap
  // round-trip; the video upload may take a while).
  const [pendingAvatarId, setPendingAvatarId] = useState<string | null>(null);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Per-row inline avatar replacement state.
  const [rowAvatarLoading, setRowAvatarLoading] = useState<string | null>(null);

  // dnd-kit needs sensors per platform; PointerSensor covers mouse + pen,
  // TouchSensor covers mobile. activationConstraint avoids stealing taps
  // from buttons inside the row (delete, change avatar).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    })
  );

  const fetchAds = useCallback(async () => {
    try {
      const res = await fetch("/api/ads");
      const data = await res.json();
      setAds(data.ads || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // ── Create-form: avatar picker ─────────────────────────────────────
  const handlePickAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // Pass the brand name so the asset is named consistently in Cloudinary.
      // Empty brand falls back to a timestamp slug on the server.
      form.append("brandName", brandName.trim());
      const res = await fetch("/api/ads/avatar", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("avatar");
      const { publicId, secureUrl } = (await res.json()) as {
        publicId: string;
        secureUrl: string;
      };
      setPendingAvatarId(publicId);
      setPendingAvatarUrl(secureUrl);
    } catch {
      alert("Avatar upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // All four fields must be set before the video upload starts. The video
  // picker is also disabled in the UI when any of them is missing, so this
  // is defense-in-depth (e.g. against drag-drop onto a hidden input, or
  // programmatic triggers).
  const missingFields: string[] = [];
  if (!brandName.trim()) missingFields.push("brand name");
  if (!caption.trim()) missingFields.push("caption");
  if (!pendingAvatarId) missingFields.push("brand avatar");
  const canPublish = missingFields.length === 0;

  // ── Create-form: video upload + ad creation ────────────────────────
  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canPublish) {
      alert(`Missing: ${missingFields.join(", ")}`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      // 1. Signed payload from our API (no file passes through Vercel).
      const signRes = await fetch("/api/ads/sign");
      if (!signRes.ok) throw new Error("sign");
      const { cloudName, apiKey, timestamp, folder, signature } =
        await signRes.json();

      // 2. Upload the video straight to Cloudinary (bypasses 4.5 MB limit).
      const cloudForm = new FormData();
      cloudForm.append("file", file);
      cloudForm.append("api_key", apiKey);
      cloudForm.append("timestamp", timestamp);
      cloudForm.append("folder", folder);
      cloudForm.append("signature", signature);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
        { method: "POST", body: cloudForm }
      );
      if (!uploadRes.ok) throw new Error("cloudinary");
      const { secure_url: videoUrl } = await uploadRes.json();

      // 3. Save URL + metadata (including avatar public_id if set).
      const res = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          brandName: brandName.trim(),
          caption: caption.trim(),
          brandAvatar: pendingAvatarId,
        }),
      });
      if (res.ok) {
        await fetchAds();
        setBrandName("");
        setCaption("");
        setPendingAvatarId(null);
        setPendingAvatarUrl(null);
      } else {
        const err = await res.json();
        alert(err.error || "Upload failed");
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this ad?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/ads?id=${id}`, { method: "DELETE" });
      await fetchAds();
    } catch {
      alert("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  // ── Per-row: replace avatar of an existing ad ───────────────────────
  const handleRowAvatarChange = async (ad: Ad, file: File) => {
    setRowAvatarLoading(ad.id);
    const previous = ads;
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("brandName", ad.brand_name);
      const upRes = await fetch("/api/ads/avatar", {
        method: "POST",
        body: form,
      });
      if (!upRes.ok) throw new Error("avatar");
      const { publicId } = (await upRes.json()) as { publicId: string };

      // Optimistic update so the new avatar appears instantly; rollback if
      // the persistence step fails.
      setAds((prev) =>
        prev.map((a) => (a.id === ad.id ? { ...a, brand_avatar: publicId } : a))
      );

      const patchRes = await fetch(`/api/ads/${ad.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandAvatar: publicId }),
      });
      if (!patchRes.ok) throw new Error("patch");
    } catch {
      setAds(previous);
      alert("Avatar update failed");
    } finally {
      setRowAvatarLoading(null);
    }
  };

  // ── Drag-and-drop reorder ──────────────────────────────────────────
  const adIds = useMemo(() => ads.map((a) => a.id), [ads]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ads.findIndex((a) => a.id === active.id);
    const newIndex = ads.findIndex((a) => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = ads;
    // Reassign sort_order densely (0..n-1). The mobile app only cares
    // about relative ascending order, not the absolute values.
    const reordered = arrayMove(ads, oldIndex, newIndex).map((a, i) => ({
      ...a,
      sort_order: i,
    }));
    setAds(reordered);

    try {
      const res = await fetch("/api/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: reordered.map((a) => ({ id: a.id, sortOrder: a.sort_order })),
        }),
      });
      if (!res.ok) throw new Error("reorder");
    } catch {
      setAds(previous);
      alert("Reorder failed");
    }
  };

  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="border-b border-neutral-800 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            ATTO SOUND
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">
            Feed Ad Management
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        {/* ── Create form ─────────────────────────────────────────── */}
        <div className="mb-8 space-y-3">
          <div className="flex items-stretch gap-3">
            {/* Avatar picker — sized to match the stacked input column so the
                two read as a single block. h-28 w-28 (112px) lines up with
                2× py-3 inputs + the 12px gap. */}
            <label
              className={`relative flex h-28 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-neutral-700 bg-neutral-950 transition-colors hover:border-white ${
                uploadingAvatar ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {pendingAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pendingAvatarUrl}
                  alt="Brand avatar"
                  className="h-full w-full object-cover"
                />
              ) : uploadingAvatar ? (
                <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
              ) : (
                <div className="flex flex-col items-center gap-1 px-2 text-center">
                  <ImageIcon className="h-6 w-6 text-neutral-500" />
                  <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                    Brand avatar
                  </span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePickAvatar}
                disabled={uploadingAvatar}
              />
            </label>

            <div className="flex flex-1 flex-col gap-3">
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Brand name (e.g. Apple, Nike)"
                className="w-full flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none"
              />
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption"
                className="w-full flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none"
              />
            </div>
          </div>

          {/* Video upload — styled as a primary CTA so it's always read as
              "the button" even when disabled. When fields are missing we
              keep the icon + label at full opacity (so it doesn't blend
              into the background) and show what's missing on a second line
              in amber so the user knows exactly what to fix. */}
          <label
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 px-4 py-6 text-center transition-colors sm:py-7 ${
              uploading
                ? "pointer-events-none border-neutral-700 bg-neutral-950"
                : canPublish
                  ? "cursor-pointer border-white bg-white text-black hover:bg-neutral-200"
                  : "pointer-events-none border-neutral-700 bg-neutral-950"
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              {uploading ? (
                <Loader2
                  className={`h-5 w-5 animate-spin ${
                    canPublish ? "text-black" : "text-neutral-400"
                  }`}
                />
              ) : (
                <Upload
                  className={`h-5 w-5 ${
                    canPublish ? "text-black" : "text-neutral-400"
                  }`}
                />
              )}
              <span
                className={`text-sm font-semibold ${
                  canPublish && !uploading ? "text-black" : "text-neutral-400"
                }`}
              >
                {uploading ? "Uploading video..." : "Upload ad video"}
              </span>
            </div>
            {!uploading && !canPublish && (
              <span className="text-xs text-amber-400">
                Add {missingFields.join(", ")} first
              </span>
            )}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading || !canPublish}
            />
          </label>
        </div>

        {/* ── Ads list (sortable) ─────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-600" />
          </div>
        ) : ads.length === 0 ? (
          <p className="py-20 text-center text-sm text-neutral-600">
            No ads yet. Upload one above.
          </p>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Active Ads ({ads.length}) — drag to reorder
            </h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={adIds}
                strategy={verticalListSortingStrategy}
              >
                {ads.map((ad) => (
                  <SortableAdRow
                    key={ad.id}
                    ad={ad}
                    onDelete={handleDelete}
                    onAvatarChange={handleRowAvatarChange}
                    deleting={deleting === ad.id}
                    avatarLoading={rowAvatarLoading === ad.id}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sortable row component ────────────────────────────────────────────

interface SortableAdRowProps {
  ad: Ad;
  onDelete: (id: string) => void;
  onAvatarChange: (ad: Ad, file: File) => void;
  deleting: boolean;
  avatarLoading: boolean;
}

function SortableAdRow({
  ad,
  onDelete,
  onAvatarChange,
  deleting,
  avatarLoading,
}: SortableAdRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ad.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarUrl = avatarPreview(ad.brand_avatar);
  const thumbUrl = videoThumb(ad.video_url);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3 sm:gap-4 sm:p-4"
    >
      {/* Drag handle — kept off the row body so taps on delete still register. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab rounded-lg p-1 text-neutral-600 hover:text-neutral-300 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Video thumbnail (Cloudinary poster frame) */}
      <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl}
          alt={`${ad.brand_name} thumbnail`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Brand avatar (click to change) */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={avatarLoading}
        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-neutral-700 bg-neutral-900 transition-opacity hover:opacity-80 disabled:opacity-50"
        aria-label="Change brand avatar"
      >
        {avatarLoading ? (
          <Loader2 className="m-auto h-4 w-4 animate-spin text-neutral-400" />
        ) : avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`${ad.brand_name} avatar`}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="m-auto h-4 w-4 text-neutral-600" />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onAvatarChange(ad, file);
          }}
        />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{ad.brand_name}</p>
        <p className="truncate text-xs text-neutral-500">
          {ad.caption || "No caption"}
        </p>
      </div>

      <button
        onClick={() => onDelete(ad.id)}
        disabled={deleting}
        className="shrink-0 rounded-lg p-2.5 text-neutral-600 transition-colors active:bg-red-950 active:text-red-400 sm:hover:bg-red-950 sm:hover:text-red-400 disabled:opacity-50"
        aria-label="Delete ad"
      >
        {deleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
