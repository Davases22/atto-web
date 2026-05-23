"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Allow the middleware to bounce users back to wherever they were trying
  // to reach. Default to /admin/waitlist since that's the main admin entry.
  const next = params.get("next") || "/admin/waitlist";

  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.trim()) return toast.error("Enter your admin user");
    if (!pass) return toast.error("Enter your password");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.trim(), pass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sign-in failed");
      router.replace(next);
      router.refresh();
    } catch (err) {
      toast.error("Couldn't sign in", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl sm:p-7"
    >
      <h1 className="text-lg font-semibold text-white">Admin sign in</h1>
      <p className="mt-1 text-xs text-neutral-500">
        Use your ATTO SOUND admin credentials.
      </p>

      <div className="mt-5 space-y-3">
        <div>
          <label
            htmlFor="user"
            className="mb-1 block text-xs uppercase tracking-wider text-neutral-500"
          >
            User
          </label>
          <input
            id="user"
            type="text"
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-base text-white placeholder-neutral-700 focus:border-white focus:outline-none sm:text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="pass"
            className="mb-1 block text-xs uppercase tracking-wider text-neutral-500"
          >
            Password
          </label>
          <input
            id="pass"
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-base text-white placeholder-neutral-700 focus:border-white focus:outline-none sm:text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        Sign in
      </button>
    </form>
  );
}

// useSearchParams() requires a Suspense boundary in the App Router; the
// outer page provides it so the form can read ?next= on mount.
export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-4 py-10">
      <Suspense
        fallback={
          <div className="text-sm text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
