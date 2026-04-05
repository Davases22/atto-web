"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Upload, Trash2, Loader2 } from "lucide-react";

interface Logo {
  id: string;
  image_url: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export default function AdminLogosPage() {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchLogos = useCallback(async () => {
    try {
      const res = await fetch("/api/logos");
      const data = await res.json();
      setLogos(data.logos || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogos();
  }, [fetchLogos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/logos", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await fetchLogos();
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
    if (!confirm("Delete this logo? It will be removed from the app.")) return;

    setDeleting(id);
    try {
      await fetch(`/api/logos?id=${id}`, { method: "DELETE" });
      await fetchLogos();
    } catch {
      alert("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-dvh bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-800 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            ATTO SOUND
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">
            Creator Logo Management
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Upload */}
        <label
          className={`mb-8 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-700 px-4 py-8 text-center transition-colors hover:border-white sm:flex-row sm:gap-3 sm:px-6 sm:py-10 ${
            uploading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          ) : (
            <Upload className="h-5 w-5 text-neutral-400" />
          )}
          <span className="text-sm text-neutral-400">
            {uploading ? "Uploading..." : "Tap to upload a new creator logo"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>

        {/* Logo list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-600" />
          </div>
        ) : logos.length === 0 ? (
          <p className="py-20 text-center text-sm text-neutral-600">
            No logos yet. Upload one above.
          </p>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Active Logos ({logos.length})
            </h2>

            {logos.map((logo) => (
              <div
                key={logo.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3 sm:gap-4 sm:p-4"
              >
                {/* Thumbnail */}
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-900 sm:h-14 sm:w-24">
                  <Image
                    src={logo.image_url}
                    alt="Creator logo"
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-neutral-400 sm:text-sm">
                    {decodeURIComponent(
                      logo.image_url.split("/").pop() || ""
                    )}
                  </p>
                  <p className="mt-0.5 text-[10px] text-neutral-600 sm:text-xs">
                    #{logo.sort_order + 1} ·{" "}
                    {logo.active ? "Active" : "Inactive"}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(logo.id)}
                  disabled={deleting === logo.id}
                  className="shrink-0 rounded-lg p-2.5 text-neutral-600 transition-colors active:bg-red-950 active:text-red-400 sm:hover:bg-red-950 sm:hover:text-red-400 disabled:opacity-50"
                  aria-label="Delete logo"
                >
                  {deleting === logo.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
