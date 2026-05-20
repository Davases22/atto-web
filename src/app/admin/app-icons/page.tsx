"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload, Trash2, Loader2, AlertCircle } from "lucide-react";

interface AppIcon {
  id: string;
  slotName: string;
  name: string;
  previewUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

const KNOWN_SLOTS = ["metal", "aurora"] as const;

export default function AdminAppIconsPage() {
  const [icons, setIcons] = useState<AppIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [slotName, setSlotName] = useState<string>(KNOWN_SLOTS[0]);
  const [displayName, setDisplayName] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("0");
  const [isActive, setIsActive] = useState<boolean>(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchIcons = useCallback(async () => {
    try {
      const res = await fetch("/api/app-icons");
      const data = await res.json();
      setIcons(data.icons || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIcons();
  }, [fetchIcons]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      alert("Pick a 1024×1024 PNG preview first.");
      return;
    }
    if (!slotName.trim()) {
      alert("Slot name is required.");
      return;
    }
    if (!displayName.trim()) {
      alert("Display name is required.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slotName", slotName.trim());
      formData.append("name", displayName.trim());
      formData.append("sortOrder", String(Number(sortOrder) || 0));
      formData.append("isActive", isActive ? "true" : "false");

      const res = await fetch("/api/app-icons", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        // Reset form (keep slotName so admin can iterate fast on one slot).
        setDisplayName("");
        setSortOrder("0");
        setIsActive(true);
        if (fileRef.current) fileRef.current.value = "";
        await fetchIcons();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Upload failed");
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? The icon stays in the binary but disappears from the picker.`)) {
      return;
    }
    setDeleting(id);
    try {
      await fetch(`/api/app-icons?id=${id}`, { method: "DELETE" });
      await fetchIcons();
    } catch {
      alert("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="border-b border-neutral-800 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            ATTO SOUND
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">
            App Icon Management
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Notice about the native constraint */}
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm">
          <AlertCircle
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400"
            aria-hidden
          />
          <div>
            <p className="font-medium text-amber-200">
              Icons must be pre-bundled in the binary.
            </p>
            <p className="mt-1 text-amber-200/70">
              The <code className="rounded bg-amber-900/40 px-1">slotName</code>{" "}
              you choose here only points at a slot already shipped in the app
              build. Adding a NEW icon requires editing{" "}
              <code className="rounded bg-amber-900/40 px-1">app.json</code> in
              the mobile repo and cutting a new EAS build. Current shipped
              slots: <code className="rounded bg-amber-900/40 px-1">metal</code>,{" "}
              <code className="rounded bg-amber-900/40 px-1">aurora</code>.
            </p>
          </div>
        </div>

        {/* Upload form */}
        <section className="mb-10 rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="mb-4 text-lg font-semibold">Add / update icon</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-400">Slot name (must match binary)</span>
              <input
                type="text"
                list="known-slots"
                value={slotName}
                onChange={(e) => setSlotName(e.target.value)}
                placeholder="e.g. metal"
                className="rounded-lg border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                disabled={uploading}
              />
              <datalist id="known-slots">
                {KNOWN_SLOTS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-400">Display name (shown to users)</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Metal"
                className="rounded-lg border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                disabled={uploading}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-400">Sort order (lower = first)</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="rounded-lg border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                disabled={uploading}
              />
            </label>

            <label className="flex items-center gap-2 self-end text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={uploading}
                className="h-4 w-4"
              />
              Active (visible in picker)
            </label>
          </div>

          <label className="mt-4 flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-400">Preview thumbnail (1024×1024 PNG recommended)</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/webp,image/jpeg"
              disabled={uploading}
              className="text-sm text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-neutral-700"
            />
          </label>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition disabled:opacity-50 sm:hover:bg-neutral-200"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading…" : "Save"}
          </button>
        </section>

        {/* List */}
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Catalogue {!loading && `(${icons.length})`}
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
            </div>
          ) : icons.length === 0 ? (
            <p className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-center text-sm text-neutral-500">
              No icons yet. Add the first one above.
            </p>
          ) : (
            <ul className="space-y-3">
              {icons.map((icon) => (
                <li
                  key={icon.id}
                  className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-950 p-3 sm:p-4"
                >
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-900">
                    <Image
                      src={icon.previewUrl}
                      alt={icon.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {icon.name}{" "}
                      <span className="text-neutral-500">· {icon.slotName}</span>
                    </p>
                    <p className="text-xs text-neutral-500">
                      sort {icon.sortOrder} ·{" "}
                      <span className={icon.isActive ? "text-emerald-400" : "text-neutral-500"}>
                        {icon.isActive ? "active" : "inactive"}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(icon.id, icon.name)}
                    disabled={deleting === icon.id}
                    aria-label={`Delete ${icon.name}`}
                    className="rounded-md p-2 text-neutral-400 transition disabled:opacity-50 sm:hover:bg-red-950/40 sm:hover:text-red-300"
                  >
                    {deleting === icon.id ? (
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
      </main>
    </div>
  );
}
