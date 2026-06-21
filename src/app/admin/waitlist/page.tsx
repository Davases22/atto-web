"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  Check,
} from "lucide-react";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

// Pre-compute the country list once. libphonenumber-js bundles ~250 countries;
// we sort by dial code so common ones (US/CA = 1) stay near the top of the
// dropdown for users picking from a long alphabetical list.
const COUNTRY_OPTIONS = getCountries()
  .map((c) => ({ code: c as CountryCode, dial: getCountryCallingCode(c) }))
  .sort((a, b) =>
    a.dial === b.dial ? a.code.localeCompare(b.code) : Number(a.dial) - Number(b.dial)
  );

/** Render the ISO country code as its flag emoji via regional-indicator code points. */
function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}

interface Signup {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  platform_preference: "ios" | "android" | null;
  source: string;
  created_at: string | null;
  updated_at: string | null;
}

type Platform = "all" | "ios" | "android" | "unknown";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
  { value: "unknown", label: "Unknown" },
];

const PAGE_SIZE = 50;

export default function AdminWaitlistPage() {
  const router = useRouter();
  const [signups, setSignups] = useState<Signup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [platform, setPlatform] = useState<Platform>("all");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Signup | null>(null);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Export honours the current search + platform filters so what you see
      // is what you get, but pulls every matching row (not just this page).
      const qs = new URLSearchParams({ search: debouncedSearch, platform });
      const res = await fetch(`/api/admin/waitlist/export?${qs.toString()}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (err) {
      toast.error("Couldn't export CSV", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/waitlist/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Import failed");
      toast.success(
        `Imported ${data.inserted} signup${data.inserted === 1 ? "" : "s"}`,
        {
          description: `${data.skipped} duplicate${data.skipped === 1 ? "" : "s"} skipped · ${data.dropped} row${data.dropped === 1 ? "" : "s"} dropped (missing timestamp/email) · total now ${data.total}`,
        }
      );
      await fetchSignups();
    } catch (err) {
      toast.error("Couldn't import CSV", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // best-effort; even if the request fails the cookie will eventually expire
    }
    router.replace("/admin/login");
  };

  // Debounce the search input so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const fetchSignups = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        search: debouncedSearch,
        platform,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const res = await fetch(`/api/admin/waitlist?${qs.toString()}`);
      if (!res.ok) throw new Error("Bad response");
      const data = await res.json();
      setSignups(data.signups || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Couldn't load signups", {
        description: "Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, platform, offset]);

  useEffect(() => {
    fetchSignups();
  }, [fetchSignups]);

  const handleDelete = async (signup: Signup) => {
    const label = `${signup.first_name} ${signup.last_name}`.trim() || signup.email;
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeletingId(signup.id);
    try {
      const res = await fetch(`/api/admin/waitlist/${signup.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      toast.success(`${label} was removed from the waitlist`);
      await fetchSignups();
    } catch (err) {
      toast.error("Couldn't delete signup", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="border-b border-neutral-800 px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-2xl">
              ATTO SOUND
            </h1>
            <p className="mt-0.5 truncate text-xs text-neutral-500 sm:text-sm">
              Waitlist · {total} signup{total === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-900 disabled:opacity-50"
              title="Download CSV"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Download</span>
            </button>
            <label
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-900 ${
                importing ? "pointer-events-none opacity-50" : ""
              }`}
              title="Import CSV"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Import</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImport}
                disabled={importing}
              />
            </label>
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition-opacity hover:opacity-80"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
            <button
              onClick={signOut}
              disabled={signingOut}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-900 disabled:opacity-50"
              aria-label="Sign out"
              title="Sign out"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Search + platform filter */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or phone…"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 py-2.5 pl-10 pr-3 text-base text-white placeholder-neutral-600 focus:border-white focus:outline-none sm:text-sm"
            />
          </div>
          <div className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-950 p-1">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setPlatform(p.value);
                  setOffset(0);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  platform === p.value
                    ? "bg-white text-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-600" />
          </div>
        ) : signups.length === 0 ? (
          <p className="py-20 text-center text-sm text-neutral-600">
            No signups match your filters.
          </p>
        ) : (
          <>
            {/* Mobile: card list. Tables don't survive narrow viewports without
                making columns ellipsize uncomfortably; cards keep every field
                readable and put actions within thumb reach. */}
            <ul className="space-y-2 sm:hidden">
              {signups.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-neutral-400">
                        {s.email}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {s.phone_number || "—"}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-500">
                        <PlatformChip value={s.platform_preference} />
                        <span>·</span>
                        <span>{formatDate(s.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => setEditing(s)}
                        className="rounded-lg p-2 text-neutral-400 active:bg-neutral-900 active:text-white"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.id}
                        className="rounded-lg p-2 text-neutral-400 active:bg-red-950 active:text-red-400 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        {deletingId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop / tablet: keep the dense table */}
            <div className="hidden overflow-x-auto rounded-xl border border-neutral-800 sm:block">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-950 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">First name</th>
                    <th className="px-4 py-3 font-medium">Last name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Platform</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {signups.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-950/60">
                      <td className="px-4 py-3 font-medium">{s.first_name}</td>
                      <td className="px-4 py-3 font-medium">{s.last_name}</td>
                      <td className="px-4 py-3 text-neutral-400">{s.email}</td>
                      <td className="px-4 py-3 text-neutral-400">
                        {s.phone_number || (
                          <span className="text-neutral-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <PlatformChip value={s.platform_preference} />
                      </td>
                      <td className="px-4 py-3 text-neutral-500">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditing(s)}
                            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-white"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            disabled={deletingId === s.id}
                            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-red-950 hover:text-red-400 disabled:opacity-50"
                            aria-label="Delete"
                          >
                            {deletingId === s.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
            <span>
              Page {currentPage} of {pageCount}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="rounded-lg border border-neutral-800 px-3 py-1.5 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() =>
                  setOffset(
                    Math.min((pageCount - 1) * PAGE_SIZE, offset + PAGE_SIZE)
                  )
                }
                disabled={currentPage === pageCount}
                className="rounded-lg border border-neutral-800 px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>

      {(adding || editing) && (
        <SignupFormModal
          signup={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            fetchSignups();
          }}
        />
      )}
    </div>
  );
}

function PlatformChip({ value }: { value: "ios" | "android" | null }) {
  if (!value) {
    return <span className="text-xs text-neutral-700">—</span>;
  }
  const label = value === "ios" ? "iOS" : "Android";
  return (
    <span className="inline-flex rounded-full border border-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
      {label}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SignupFormModal({
  signup,
  onClose,
  onSaved,
}: {
  signup: Signup | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = signup !== null;
  const [firstName, setFirstName] = useState(signup?.first_name ?? "");
  const [lastName, setLastName] = useState(signup?.last_name ?? "");
  const [email, setEmail] = useState(signup?.email ?? "");
  // Phone is split into a country selector and a local-digits field so the
  // admin can't accidentally save a number without an international prefix.
  // For existing signups we try to parse the stored E.164 to pre-fill both
  // fields; legacy rows that stored bare 10-digit US numbers are assumed US.
  const initial = useMemo(() => {
    const raw = signup?.phone_number ?? "";
    if (!raw) return { country: "US" as CountryCode, local: "" };
    const parsed = parsePhoneNumberFromString(raw.startsWith("+") ? raw : `+${raw}`);
    if (parsed?.country) {
      return { country: parsed.country, local: parsed.nationalNumber };
    }
    // Fall back: assume US and treat the trailing 10 digits as the national part.
    const digits = raw.replace(/\D/g, "");
    return {
      country: "US" as CountryCode,
      local: digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits,
    };
  }, [signup]);
  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [localPhone, setLocalPhone] = useState(initial.local);
  const [platform, setPlatform] = useState<"" | "ios" | "android">(
    signup?.platform_preference ?? ""
  );
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(
    () => firstName.trim() && lastName.trim() && email.trim() && !saving,
    [firstName, lastName, email, saving]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Surface the first missing required field as a toast so the user knows
    // exactly which one is blocking the submit, even when the button is
    // visibly disabled.
    if (!firstName.trim()) return toast.error("First name is required");
    if (!lastName.trim()) return toast.error("Last name is required");
    if (!email.trim()) return toast.error("Email is required");
    if (saving) return;
    setSaving(true);
    try {
      // Build E.164 from the country code + local digits. An empty local
      // means "no phone" — we send null so the column stays clean rather
      // than storing a bare dial code with no number behind it.
      const digits = localPhone.replace(/\D/g, "");
      const phone = digits ? `+${getCountryCallingCode(country)}${digits}` : null;
      const body = {
        firstName,
        lastName,
        email,
        phone,
        platform: platform || null,
      };
      const res = await fetch(
        isEdit ? `/api/admin/waitlist/${signup!.id}` : "/api/admin/waitlist",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      toast.success(isEdit ? "Changes saved" : "Signup added");
      onSaved();
    } catch (err) {
      toast.error(isEdit ? "Couldn't save changes" : "Couldn't add signup", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/70 p-3 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-4 shadow-2xl sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit signup" : "Add signup"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-900 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="First name"
              value={firstName}
              onChange={setFirstName}
              autoFocus
            />
            <Field label="Last name" value={lastName} onChange={setLastName} />
          </div>
          <Field label="Email" type="email" value={email} onChange={setEmail} />
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-neutral-500">
              Phone
            </label>
            <div className="flex gap-2">
              <div className="relative">
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value as CountryCode)}
                  className="h-full appearance-none rounded-xl border border-neutral-700 bg-neutral-950 py-2.5 pl-3 pr-7 text-base text-white focus:border-white focus:outline-none sm:py-2 sm:text-sm"
                  aria-label="Country code"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {flagEmoji(c.code)} {c.code} +{c.dial}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="tel"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                placeholder="555 123 4567"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-base text-white placeholder-neutral-700 focus:border-white focus:outline-none sm:py-2 sm:text-sm"
              />
            </div>
            <p className="mt-1 text-[11px] text-neutral-600">
              Saved as +{getCountryCallingCode(country)}
              {localPhone.replace(/\D/g, "") || "…"}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-neutral-500">
              Platform
            </label>
            <div className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-950 p-1">
              {(["", "ios", "android"] as const).map((p) => (
                <button
                  key={p || "none"}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    platform === p
                      ? "bg-white text-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {p === "" ? "Unknown" : p === "ios" ? "iOS" : "Android"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:opacity-80 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isEdit ? "Save" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        // text-base on mobile prevents iOS Safari from zooming the viewport
        // when the input receives focus.
        className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-base text-white placeholder-neutral-700 focus:border-white focus:outline-none sm:py-2 sm:text-sm"
      />
    </div>
  );
}
