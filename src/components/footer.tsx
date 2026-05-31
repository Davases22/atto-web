import Link from "next/link";

export default function Footer() {
  return (
    <footer className="px-8 py-6 text-xs text-neutral-500">
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-12">
        <nav className="flex items-center gap-x-6 whitespace-nowrap">
          <Link href="/privacy" className="transition-colors hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-white">
            Terms of Service
          </Link>
        </nav>

        <p className="leading-relaxed text-neutral-600 sm:text-right">
          By signing up you agree to receive text messages from ATTO SOUND.
          Msg&nbsp;&amp;&nbsp;data rates may apply. Reply STOP to unsubscribe.
          &nbsp;&copy;&nbsp;2026 ATTO SOUND. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
