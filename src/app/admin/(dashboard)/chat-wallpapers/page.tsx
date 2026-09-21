"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, Loader2, EyeOff, Eye } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";

type Kind = "image" | "gradient" | "pattern";

interface ChatWallpaper {
  id: string;
  name: string;
  kind: Kind;
  imageUrl: string;
  patternUrl?: string | null;
  gradientColors?: string[] | null;
  overlayOpacity?: number | null;
  patternOpacity?: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

const KIND_HELP: Record<Kind, string> = {
  image: "A seamless tile (PNG or JPG). It repeats behind the chat.",
  gradient:
    "Two to four colours. The phone draws it and turns it a quarter turn on every sent message.",
  pattern:
    "A gradient plus a transparent PNG of white line art doodles drawn over it, like Telegram.",
};

function gradientCss(colors?: string[] | null): string {
  const list = (colors ?? []).filter(Boolean);
  if (list.length === 0) return "#111";
  if (list.length === 1) return list[0];
  return `linear-gradient(135deg, ${list.join(", ")})`;
}

export default function AdminChatWallpapersPage() {
  const [wallpapers, setWallpapers] = useState<ChatWallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("pattern");
  const [colors, setColors] = useState("#0B0B0F, #1C1330, #0F2338, #0B0B0F");
  const [overlay, setOverlay] = useState("0.35");
  const [patternOpacity, setPatternOpacity] = useState("0.18");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const imageRef = useRef<HTMLInputElement>(null);
  const patternRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-wallpapers");
      const data = await res.json();
      setWallpapers(data.wallpapers || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Name is required.");
      return;
    }
    const image = imageRef.current?.files?.[0];
    const pattern = patternRef.current?.files?.[0];
    if (kind === "image" && !image) {
      alert("Pick the image tile first.");
      return;
    }
    if (kind === "pattern" && !pattern) {
      alert("Pick the pattern tile (transparent PNG) first.");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("kind", kind);
      formData.append("gradientColors", colors);
      formData.append("overlayOpacity", overlay);
      formData.append("patternOpacity", patternOpacity);
      formData.append("sortOrder", String(Number(sortOrder) || 0));
      formData.append("isActive", isActive ? "true" : "false");
      if (image) formData.append("image", image);
      if (pattern) formData.append("pattern", pattern);

      const res = await fetch("/api/chat-wallpapers", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setName("");
        if (imageRef.current) imageRef.current.value = "";
        if (patternRef.current) patternRef.current.value = "";
        await fetchAll();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Save failed");
      }
    } catch {
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (w: ChatWallpaper) => {
    setBusyId(w.id);
    try {
      await fetch(`/api/chat-wallpapers?id=${w.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !w.isActive }),
      });
      await fetchAll();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (w: ChatWallpaper) => {
    if (
      !confirm(
        `Delete "${w.name}"? Phones that picked it fall back to the default wallpaper.`,
      )
    )
      return;
    setBusyId(w.id);
    try {
      await fetch(`/api/chat-wallpapers?id=${w.id}`, { method: "DELETE" });
      await fetchAll();
    } finally {
      setBusyId(null);
    }
  };

  const inputClass =
    "rounded-lg border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600";

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Chat wallpapers"
        description="Backgrounds users can pick for their chats. Changes reach phones on the next app focus, no build needed."
      />

      <section className="mb-10 rounded-xl border border-neutral-800 bg-neutral-950 p-5">
        <h2 className="mb-4 text-lg font-semibold">Add wallpaper</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-400">Name (shown to users)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Studio"
              className={inputClass}
              disabled={saving}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-400">Kind</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className={inputClass}
              disabled={saving}
            >
              <option value="pattern">Pattern (gradient + doodles)</option>
              <option value="gradient">Gradient</option>
              <option value="image">Image tile</option>
            </select>
            <span className="text-xs text-neutral-500">{KIND_HELP[kind]}</span>
          </label>

          {kind !== "image" && (
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="text-neutral-400">
                Gradient colours (two to four HEX, comma separated)
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={colors}
                  onChange={(e) => setColors(e.target.value)}
                  className={`${inputClass} flex-1`}
                  disabled={saving}
                />
                <div
                  className="h-10 w-16 flex-shrink-0 rounded-lg border border-neutral-800"
                  style={{
                    background: gradientCss(
                      colors.split(/[,\s]+/).filter(Boolean),
                    ),
                  }}
                  aria-hidden
                />
              </div>
            </label>
          )}

          {kind === "image" && (
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="text-neutral-400">
                Image tile (seamless PNG or JPG)
              </span>
              <input
                ref={imageRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={saving}
                className="text-sm text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-sm file:text-white"
              />
            </label>
          )}

          {kind === "pattern" && (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-neutral-400">
                  Pattern tile (transparent PNG, white line art)
                </span>
                <input
                  ref={patternRef}
                  type="file"
                  accept="image/png"
                  disabled={saving}
                  className="text-sm text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-sm file:text-white"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-neutral-400">
                  Pattern opacity (0 to 1)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={patternOpacity}
                  onChange={(e) => setPatternOpacity(e.target.value)}
                  className={inputClass}
                  disabled={saving}
                />
              </label>
            </>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-400">
              Dark veil opacity (0 to 0.45, keeps bubbles legible)
            </span>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={overlay}
              onChange={(e) => setOverlay(e.target.value)}
              className={inputClass}
              disabled={saving}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-400">Sort order (lower first)</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={inputClass}
              disabled={saving}
            />
          </label>

          <label className="flex items-center gap-2 self-end text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={saving}
              className="h-4 w-4"
            />
            Active (visible in the picker)
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition disabled:opacity-50 sm:hover:bg-neutral-200"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {saving ? "Saving…" : "Save"}
        </button>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Catalogue {!loading && `(${wallpapers.length})`}
        </h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
          </div>
        ) : wallpapers.length === 0 ? (
          <p className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-center text-sm text-neutral-500">
            No wallpapers yet. Add the first one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {wallpapers.map((w) => (
              <li
                key={w.id}
                className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-950 p-3 sm:p-4"
              >
                <div
                  className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-neutral-800"
                  style={{
                    background:
                      w.kind === "image"
                        ? `url(${w.imageUrl}) center / 64px repeat`
                        : gradientCss(w.gradientColors),
                  }}
                >
                  {w.kind === "pattern" && w.patternUrl ? (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${w.patternUrl})`,
                        backgroundSize: "120px",
                        opacity: w.patternOpacity ?? 0.18,
                      }}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {w.name}{" "}
                    <span className="text-neutral-500">· {w.kind}</span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    sort {w.sortOrder} · veil {w.overlayOpacity ?? "default"} ·{" "}
                    <span
                      className={w.isActive ? "text-white" : "text-neutral-500"}
                    >
                      {w.isActive ? "active" : "retired"}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => handleToggle(w)}
                  disabled={busyId === w.id}
                  aria-label={
                    w.isActive ? `Retire ${w.name}` : `Restore ${w.name}`
                  }
                  className="rounded-md p-2 text-neutral-400 transition disabled:opacity-50 sm:hover:bg-neutral-900 sm:hover:text-white"
                >
                  {w.isActive ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(w)}
                  disabled={busyId === w.id}
                  aria-label={`Delete ${w.name}`}
                  className="rounded-md p-2 text-neutral-400 transition disabled:opacity-50 sm:hover:bg-red-950/40 sm:hover:text-red-300"
                >
                  {busyId === w.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
