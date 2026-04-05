"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload, Trash2, Loader2, Play } from "lucide-react";

interface Ad {
  id: string;
  video_url: string;
  brand_name: string;
  caption: string;
  sort_order: number;
  active: boolean;
}

export default function AdminAdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [caption, setCaption] = useState("");

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !brandName.trim()) {
      alert("Please enter a brand name first");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("brandName", brandName.trim());
      formData.append("caption", caption.trim());

      const res = await fetch("/api/ads", { method: "POST", body: formData });
      if (res.ok) {
        await fetchAds();
        setBrandName("");
        setCaption("");
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
        {/* Upload form */}
        <div className="mb-8 space-y-3">
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Brand name (e.g. Apple, Nike)"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none"
          />
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none"
          />
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-700 px-4 py-8 text-center transition-colors hover:border-white sm:flex-row sm:gap-3 ${
              uploading || !brandName.trim()
                ? "pointer-events-none opacity-50"
                : ""
            }`}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
            ) : (
              <Upload className="h-5 w-5 text-neutral-400" />
            )}
            <span className="text-sm text-neutral-400">
              {uploading
                ? "Uploading video..."
                : brandName.trim()
                  ? "Tap to upload ad video"
                  : "Enter brand name first"}
            </span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading || !brandName.trim()}
            />
          </label>
        </div>

        {/* Ads list */}
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
              Active Ads ({ads.length})
            </h2>
            {ads.map((ad) => (
              <div
                key={ad.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3 sm:gap-4 sm:p-4"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-900">
                  <Play className="h-5 w-5 text-neutral-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">
                    {ad.brand_name}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {ad.caption || "No caption"}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(ad.id)}
                  disabled={deleting === ad.id}
                  className="shrink-0 rounded-lg p-2.5 text-neutral-600 transition-colors active:bg-red-950 active:text-red-400 sm:hover:bg-red-950 sm:hover:text-red-400 disabled:opacity-50"
                >
                  {deleting === ad.id ? (
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
