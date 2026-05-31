"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import SignUpModal from "@/components/signup-modal";
import WaitlistCounter from "@/components/waitlist-counter";

// Shared transparent hotspot layered over the button image. The render carries
// all the lighting; these just make each button clickable + keyboard-focusable.
const hotspotClass =
  "absolute cursor-pointer rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";

export default function Hero() {
  const [open, setOpen] = useState(false);
  const [signUpCount, setSignUpCount] = useState(0);

  return (
    <section className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#100e10]">
      {/* First screen fills the viewport; the footer links sit pinned at its
          bottom edge, while the legal text in <Footer> falls just below the fold. */}
      {/* White key light beaming down from the top — like a spotlight aimed at the logo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(90% 70% at 50% -10%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.06) 35%, transparent 60%)",
          }}
        />
        {/* Subtle vignette so the edges fall off into shadow, giving the matte surface depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 42%, transparent 60%, rgba(0, 0, 0, 0.4) 100%)",
          }}
        />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-4 pt-6 sm:gap-8">
          {/* 3D render of the equalizer badge. To restore the animated SVG, re-import
              Logo from "@/components/logo" and replace <Image> with <Logo className="w-72 sm:w-88" />. */}
          <Image
            src="/logo-3d.png"
            alt="ATTO Sound"
            width={600}
            height={600}
            priority
            className="w-88 sm:w-[28rem]"
          />

          {/* The exact 3D render the client made, used directly as one image.
              Transparent hotspots (positioned in % of the 1206×653 source) sit
              over each button: Sign Up opens the modal, the three circles
              deep-link to the socials. */}
          <div className="relative mt-6 w-full max-w-[18rem] sm:mt-10 sm:max-w-[20rem]">
            <Image
              src="/buttons-3d.png"
              alt=""
              width={1206}
              height={653}
              priority
              draggable={false}
              className="h-auto w-full select-none"
            />

            {/* Sign Up pill — opens the waitlist modal */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Sign Up"
              className={hotspotClass}
              style={{ left: "27.0%", top: "6.5%", width: "45.5%", height: "30.0%" }}
            />

            {/* Instagram */}
            <a
              href="https://www.instagram.com/attosound_?igsh=Mm1pNmhkOTlxNHd4&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className={`${hotspotClass} aspect-square`}
              style={{ left: "8.2%", top: "44.0%", width: "22.4%" }}
            />

            {/* TikTok */}
            <a
              href="https://www.tiktok.com/@attosound?_r=1&_t=ZP-94JSiDKOf6c"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className={`${hotspotClass} aspect-square`}
              style={{ left: "38.6%", top: "44.0%", width: "22.4%" }}
            />

            {/* YouTube */}
            <a
              href="https://www.youtube.com/@ATTOSOUND"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className={`${hotspotClass} aspect-square`}
              style={{ left: "68.6%", top: "44.0%", width: "22.4%" }}
            />
          </div>

          <WaitlistCounter increment={signUpCount} />
        </div>

        {/* Footer links pinned to the bottom of the first screen — the legal
            text lives in <Footer> just below the fold. */}
        <nav className="relative z-10 flex justify-center gap-6 pb-5 text-xs text-neutral-500">
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
