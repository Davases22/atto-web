import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-neutral-950 px-6 py-10 text-xs text-neutral-500">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link
            href="/privacy"
            className="transition-colors hover:text-white"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="transition-colors hover:text-white"
          >
            Terms of Service
          </Link>
          <Link
            href="/login"
            className="transition-colors hover:text-white"
          >
            Sign In
          </Link>
        </nav>

        <p className="leading-relaxed text-neutral-600">
          By signing up you agree to receive text messages from ATTO SOUND.
          Msg&nbsp;&amp;&nbsp;data rates may apply. Reply STOP to unsubscribe.
        </p>

        <p className="text-neutral-600">
          &copy; 2026 ATTO SOUND. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
