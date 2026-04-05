"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Upload, Trash2, GripVertical, Loader2 } from "lucide-react";

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
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-neutral-800 px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight">
            ATTO SOUND
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Creator Logo Management
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Upload */}
        <div className="mb-10">
          <label
            className={`flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-700 px-6 py-10 transition-colors hover:border-white ${
              uploading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            ) : (
              <Upload className="h-6 w-6 text-neutral-400" />
            )}
            <span className="text-sm text-neutral-400">
              {uploading
                ? "Uploading..."
                : "Click to upload a new creator logo"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          <p className="mt-2 text-center text-xs text-neutral-600">
            PNG or JPG recommended. Will appear in the Creator Focus feed header.
          </p>
        </div>

        {/* Logo Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-600" />
          </div>
        ) : logos.length === 0 ? (
          <p className="py-20 text-center text-neutral-600">
            No logos yet. Upload one above.
          </p>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">
              Active Logos ({logos.length})
            </h2>
            <div className="grid gap-4">
              {logos.map((logo) => (
                <div
                  key={logo.id}
                  className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4"
                >
                  <GripVertical className="h-5 w-5 shrink-0 text-neutral-700" />

                  <div className="relative h-16 w-32 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                    <Image
                      src={logo.image_url}
                      alt="Creator logo"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-neutral-500">
                      {logo.image_url.split("/").pop()}
                    </p>
                    <p className="text-xs text-neutral-700">
                      Order: {logo.sort_order} · {logo.active ? "Active" : "Inactive"}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDelete(logo.id)}
                    disabled={deleting === logo.id}
                    className="shrink-0 rounded-lg p-2 text-neutral-600 transition-colors hover:bg-red-950 hover:text-red-400 disabled:opacity-50"
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
          </div>
        )}
      </div>
    </div>
  );
}
