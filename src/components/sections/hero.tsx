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
      {/* Uniform matte black — no lighting effect — so the background blends
          edge to edge with no visible "bar" near the top. */}
      <div className="flex flex-1 flex-col items-center justify-start gap-6 px-4 pt-[7vh] sm:gap-7">
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

        {/* Sign Up — its own slice of the client's 3D render. A transparent
            hotspot over the pill opens the waitlist modal. */}
        <div className="relative w-full max-w-[18rem] sm:max-w-[20rem]">
          <Image
            src="/signup-3d.png"
            alt=""
            width={1206}
            height={225}
            priority
            draggable={false}
            className="h-auto w-full select-none"
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Sign Up"
            className={hotspotClass}
            style={{ left: "27%", top: "20%", width: "46%", height: "70%" }}
          />
        </div>

        {/* Social circles — separate slice, dropped a little lower than Sign Up.
            Hotspots are in % of the 1206×397 slice. */}
        <div className="relative mt-3 w-full max-w-[18rem] sm:mt-4 sm:max-w-[20rem]">
          <Image
            src="/socials-3d.png"
            alt=""
            width={1206}
            height={397}
            priority
            draggable={false}
            className="h-auto w-full select-none"
          />
          <a
            href="https://www.instagram.com/attosound_?igsh=Mm1pNmhkOTlxNHd4&utm_source=qr"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className={`${hotspotClass} aspect-square`}
            style={{ left: "8.2%", top: "7.8%", width: "22.4%" }}
          />
          <a
            href="https://www.tiktok.com/@attosound?_r=1&_t=ZP-94JSiDKOf6c"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            className={`${hotspotClass} aspect-square`}
            style={{ left: "38.6%", top: "7.8%", width: "22.4%" }}
          />
          <a
            href="https://www.youtube.com/@ATTOSOUND"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
            className={`${hotspotClass} aspect-square`}
            style={{ left: "68.6%", top: "7.8%", width: "22.4%" }}
          />
        </div>

        <WaitlistCounter increment={signUpCount} />
      </div>

      {/* Footer links pinned to the bottom of the first screen — the legal
          text lives in <Footer> just below the fold. */}
      <nav className="flex justify-center gap-6 pb-5 text-xs text-neutral-500">
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
