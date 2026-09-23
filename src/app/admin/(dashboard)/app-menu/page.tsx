"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { ArrowDown, ArrowUp, Loader2, RotateCcw, Save } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * The feed header menu (the sheet behind the three dots on the mobile feed)
 * and the launch splash mark size, edited here and read by the app on its
 * next launch or refresh. No build needed.
 *
 * Each item keeps a fixed `key` (what the app opens) while its order, label,
 * icon and visibility are the admin's. An empty label falls back to the
 * app's own translated name.
 */

type MenuItem = { key: string; label?: string; icon?: string; hidden?: boolean };

type SettingsPayload = {
  feedMenu: MenuItem[] | null;
  splashScale: number | null;
  menuItemKeys: string[];
  menuIcons: string[];
  splashScaleMin: number;
  splashScaleMax: number;
};

/** What the app draws when nothing is set: same order, labels and icons as the code. */
const DEFAULT_MENU: Required<Omit<MenuItem, "hidden">>[] = [
  { key: "following", label: "Following", icon: "Users" },
  { key: "notifications", label: "Notifications", icon: "Bell" },
  { key: "store", label: "ATTO SOUND Store", icon: "ShoppingBag" },
  { key: "about", label: "About ATTO SOUND", icon: "Info" },
  { key: "dating", label: "ATTO Encounters", icon: "Heart" },
  { key: "art", label: "ATTO ART", icon: "Palette" },
];

const KEY_HELP: Record<string, string> = {
  following: "Opens the accounts the user follows",
  notifications: "Opens notifications (keeps the unread badge)",
  store: "Merch, shows the coming soon card",
  about: "About ATTO, shows the coming soon card",
  dating: "Encounters, shows the coming soon card",
  art: "Opens the ATTO ART gallery",
};

const DEFAULT_SPLASH_SCALE = 0.3;

function IconPreview({ name, className }: { name?: string; className?: string }) {
  const Cmp = (name && (Icons as unknown as Record<string, Icons.LucideIcon>)[name]) || null;
  if (!Cmp) return <span className={className} />;
  return <Cmp className={className} strokeWidth={2.25} />;
}

/** Merge the stored menu with the defaults so every key shows exactly once. */
function normalize(stored: MenuItem[] | null): MenuItem[] {
  const base = DEFAULT_MENU.map((d) => ({ key: d.key, label: "", icon: d.icon, hidden: false }));
  if (!stored || stored.length === 0) return base;
  const seen = new Set<string>();
  const out: MenuItem[] = [];
  for (const s of stored) {
    const d = DEFAULT_MENU.find((x) => x.key === s.key);
    if (!d || seen.has(s.key)) continue;
    seen.add(s.key);
    out.push({ key: s.key, label: s.label ?? "", icon: s.icon || d.icon, hidden: !!s.hidden });
  }
  for (const b of base) if (!seen.has(b.key)) out.push(b);
  return out;
}

export default function AppMenuPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"menu" | "splash" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [icons, setIcons] = useState<string[]>(DEFAULT_MENU.map((d) => d.icon));
  const [items, setItems] = useState<MenuItem[]>(normalize(null));
  const [splashScale, setSplashScale] = useState<number>(DEFAULT_SPLASH_SCALE);
  const [splashSet, setSplashSet] = useState(false);
  const [scaleRange, setScaleRange] = useState<[number, number]>([0.15, 0.8]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app-settings", { cache: "no-store" });
      const json = (await res.json()) as { data?: SettingsPayload; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || `HTTP ${res.status}`);
      setItems(normalize(json.data.feedMenu));
      setIcons(json.data.menuIcons?.length ? json.data.menuIcons : icons);
      setScaleRange([json.data.splashScaleMin ?? 0.15, json.data.splashScaleMax ?? 0.8]);
      setSplashSet(json.data.splashScale != null);
      setSplashScale(json.data.splashScale ?? DEFAULT_SPLASH_SCALE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load settings");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const update = (index: number, patch: Partial<MenuItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const saveMenu = async () => {
    setSaving("menu");
    setError(null);
    setNotice(null);
    try {
      const payload = items.map((it) => ({
        key: it.key,
        ...(it.label?.trim() ? { label: it.label.trim() } : {}),
        ...(it.icon ? { icon: it.icon } : {}),
        ...(it.hidden ? { hidden: true } : {}),
      }));
      const res = await fetch("/api/app-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "feed-menu", items: payload }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setNotice("Menu saved. Phones pick it up on their next launch or refresh.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the menu");
    } finally {
      setSaving(null);
    }
  };

  const resetMenu = async () => {
    setSaving("menu");
    setError(null);
    try {
      const res = await fetch("/api/app-settings?key=feed-menu", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(normalize(null));
      setNotice("Menu back to the app's built in order and names.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset the menu");
    } finally {
      setSaving(null);
    }
  };

  const saveSplash = async () => {
    setSaving("splash");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/app-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "splash-scale", scale: splashScale }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSplashSet(true);
      setNotice("Splash size saved. It shows on the second launch after the change.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the splash size");
    } finally {
      setSaving(null);
    }
  };

  const resetSplash = async () => {
    setSaving("splash");
    setError(null);
    try {
      const res = await fetch("/api/app-settings?key=splash-scale", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSplashSet(false);
      setSplashScale(DEFAULT_SPLASH_SCALE);
      setNotice("Splash size back to the app default (30%).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset the splash size");
    } finally {
      setSaving(null);
    }
  };

  const previewWidth = useMemo(() => Math.round(180 * splashScale), [splashScale]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="App menu and splash"
        description="The feed's three dot menu and the launch mark size. Changes reach phones on their next launch, no build."
      />

      {error ? (
        <div className="rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-200">
          {notice}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Feed menu</h2>
            <p className="text-sm text-neutral-500">
              Order with the arrows. Leave a label empty to use the app&apos;s own name in every language.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetMenu} disabled={saving !== null || loading}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
            <Button onClick={saveMenu} disabled={saving !== null || loading}>
              {saving === "menu" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save menu
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-800">
            {items.map((it, i) => {
              const d = DEFAULT_MENU.find((x) => x.key === it.key)!;
              return (
                <div
                  key={it.key}
                  className={`grid grid-cols-[auto_44px_1fr_180px_auto] items-center gap-3 border-b border-neutral-800 px-4 py-3 last:border-b-0 ${
                    it.hidden ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white">
                    <IconPreview name={it.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <Input
                      value={it.label ?? ""}
                      placeholder={d.label}
                      maxLength={40}
                      onChange={(e) => update(i, { label: e.target.value })}
                      className="border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-600"
                    />
                    <p className="mt-1 truncate text-xs text-neutral-500">
                      {it.key} · {KEY_HELP[it.key]}
                    </p>
                  </div>
                  <select
                    value={it.icon || d.icon}
                    onChange={(e) => update(i, { icon: e.target.value })}
                    className="h-9 rounded-md border border-neutral-700 bg-neutral-900 px-2 text-sm text-white"
                  >
                    {icons.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-neutral-400">
                    <Switch checked={!it.hidden} onCheckedChange={(v) => update(i, { hidden: !v })} />
                    {it.hidden ? "Hidden" : "Shown"}
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Launch splash mark size</h2>
            <p className="text-sm text-neutral-500">
              Width of the mark as a share of the screen width. Spotify sits near 30%. {splashSet ? "" : "Currently the app default."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetSplash} disabled={saving !== null || loading}>
              <RotateCcw className="mr-2 h-4 w-4" /> Default
            </Button>
            <Button onClick={saveSplash} disabled={saving !== null || loading}>
              {saving === "splash" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save size
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex h-[200px] w-[112px] items-center justify-center rounded-[22px] border border-neutral-700 bg-black">
            <div
              className="rounded-full bg-neutral-200"
              style={{ width: Math.round(112 * splashScale), height: Math.round(112 * splashScale) }}
              title={`${previewWidth} px on a 180 px canvas`}
            />
          </div>
          <div className="flex-1 space-y-2">
            <input
              type="range"
              min={scaleRange[0]}
              max={scaleRange[1]}
              step={0.01}
              value={splashScale}
              onChange={(e) => setSplashScale(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-sm text-neutral-300">{Math.round(splashScale * 100)}% of the screen width</div>
          </div>
        </div>
      </section>
    </div>
  );
}
