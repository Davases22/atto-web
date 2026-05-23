"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  Check,
} from "lucide-react";

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
      const data = await res.json();
      setSignups(data.signups || []);
      setTotal(data.total || 0);
    } catch {
      // ignore — empty list shows fallback below
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, platform, offset]);

  useEffect(() => {
    fetchSignups();
  }, [fetchSignups]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this signup? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/waitlist/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      await fetchSignups();
    } catch {
      alert("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="border-b border-neutral-800 px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              ATTO SOUND
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">
              Waitlist Management · {total} signup{total === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition-opacity hover:opacity-80"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
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
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 py-2.5 pl-10 pr-3 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none"
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
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-950 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
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
                    <td className="px-4 py-3 font-medium">
                      {s.first_name} {s.last_name}
                    </td>
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
                          onClick={() => handleDelete(s.id)}
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
  const [phone, setPhone] = useState(signup?.phone_number ?? "");
  const [platform, setPlatform] = useState<"" | "ios" | "android">(
    signup?.platform_preference ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => firstName.trim() && lastName.trim() && email.trim() && !saving,
    [firstName, lastName, email, saving]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        firstName,
        lastName,
        email,
        phone: phone || null,
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
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
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
          <Field
            label="Phone"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="+1 555 123 4567"
          />
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

        {error && (
          <p className="mt-3 rounded-lg bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

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
        className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-700 focus:border-white focus:outline-none"
      />
    </div>
  );
}
