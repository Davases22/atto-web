import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign In | ATTO SOUND",
  description:
    "Sign in to ATTO SOUND. Account authentication is handled via SMS verification codes in the mobile app.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Sign In | ATTO SOUND",
    description:
      "Sign in to ATTO SOUND. Account authentication is handled via SMS verification codes in the mobile app.",
    url: "/login",
  },
};

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Link
          href="/"
          className="mb-12 inline-block text-sm text-neutral-400 transition-opacity hover:opacity-70"
        >
          &larr; Back
        </Link>

        <h1 className="mb-2 text-3xl font-bold sm:text-4xl">
          Sign in to ATTO SOUND
        </h1>
        <p className="mb-12 text-sm text-neutral-400">
          Secure SMS-based authentication
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
          <p>
            ATTO SOUND uses SMS verification codes (one-time passcodes) to
            securely authenticate your account. When you sign in, a unique
            code is sent to your registered phone number via text message.
          </p>
          <p>
            Account authentication is handled entirely through the ATTO SOUND
            mobile app. Download the app to create an account and sign in.
          </p>
          <p className="text-neutral-500">
            Message and data rates may apply. By signing in you agree to our{" "}
            <Link
              href="/privacy"
              className="text-neutral-400 underline underline-offset-2 transition-opacity hover:opacity-70"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              className="text-neutral-400 underline underline-offset-2 transition-opacity hover:opacity-70"
            >
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
