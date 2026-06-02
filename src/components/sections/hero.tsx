"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import SignUpModal from "@/components/signup-modal";
import WaitlistCounter from "@/components/waitlist-counter";

// Each social link wraps its own 3D render (background already removed), so the
// whole circle is the click target.
const socials = [
  {
    href: "https://www.instagram.com/attosound_?igsh=Mm1pNmhkOTlxNHd4&utm_source=qr",
    src: "/instagram-3d.png",
    label: "Instagram",
  },
  {
    href: "https://www.tiktok.com/@attosound?_r=1&_t=ZP-94JSiDKOf6c",
    src: "/tiktok-3d.png",
    label: "TikTok",
  },
  {
    href: "https://www.youtube.com/@ATTOSOUND",
    src: "/youtube-3d.png",
    label: "YouTube",
  },
];

export default function Hero() {
  const [open, setOpen] = useState(false);
  const [signUpCount, setSignUpCount] = useState(0);

  return (
    <section className="relative flex min-h-dvh w-full flex-col bg-[#100e10]">
      {/* Uniform matte black — no lighting effect — so the background blends
          edge to edge with no visible "bar" near the top. The column fills the
          full viewport on every breakpoint so the footer/legal links sit just
          below the fold and only appear once you scroll. */}
      <div className="flex min-h-dvh flex-col items-center justify-center gap-7 px-4 py-10 sm:gap-5 sm:py-6">
        {/* 3D render of the equalizer badge. To restore the animated SVG, re-import
            Logo from "@/components/logo" and replace <Image> with <Logo className="w-72 sm:w-88" />. */}
        <Image
          src="/logo-3d.png"
          alt="ATTO Sound"
          width={600}
          height={600}
          priority
          className="w-[min(26rem,44vh)] sm:w-[min(32rem,48vh)]"
        />

        {/* Sign Up — client's 3D render (background removed); the whole pill is
            the button. Opens the waitlist modal. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Sign Up"
          className="mt-6 transition-transform duration-150 will-change-transform hover:-translate-y-0.5 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70 sm:mt-4"
        >
          <Image
            src="/signup-3d.png"
            alt=""
            width={1000}
            height={562}
            priority
            unoptimized
            draggable={false}
            className="h-auto w-36 select-none sm:w-44"
          />
        </button>

        {/* Social circles — separate 3D renders, dropped a little below Sign Up. */}
        <div className="mt-3 flex items-center justify-center gap-3 sm:mt-1 sm:gap-4">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className="rounded-full transition-transform duration-150 will-change-transform hover:-translate-y-0.5 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              <Image
                src={s.src}
                alt=""
                width={800}
                height={800}
                priority
                unoptimized
                draggable={false}
                className="h-auto w-16 select-none sm:w-20"
              />
            </a>
          ))}
        </div>

        <WaitlistCounter increment={signUpCount} />
      </div>

      {/* Legal links pushed a good way below the fold — the centered column
          above already fills the viewport, and this extra top margin guarantees
          you have to scroll to reach them on every screen size. */}
      <nav className="mt-[40vh] flex justify-center gap-6 pb-5 text-xs text-neutral-500">
        <Link href="/privacy" className="transition-colors hover:text-white">
          Privacy Policy
        </Link>
        <Link href="/terms" className="transition-colors hover:text-white">
          Terms of Service
        </Link>
      </nav>

      <SignUpModal
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => setSignUpCount((c) => c + 1)}
      />
    </section>
  );
}
