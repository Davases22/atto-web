"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import SignUpModal from "@/components/signup-modal";
import WaitlistCounter from "@/components/waitlist-counter";

/** Starts heartbeat audio on first user interaction (iOS Safari compatible). */
function useHeartbeatSound() {
  useEffect(() => {
    let ctx: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval>;
    const abort = new AbortController();

    function thump(ac: AudioContext, time: number, gain: number) {
      // Low tone with frequency sweep for body
      const lo = ac.createOscillator();
      const loG = ac.createGain();
      lo.type = "sine";
      lo.frequency.setValueAtTime(150, time);
      lo.frequency.exponentialRampToValueAtTime(40, time + 0.1);
      loG.gain.setValueAtTime(gain, time);
      loG.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      lo.connect(loG).connect(ac.destination);
      lo.start(time);
      lo.stop(time + 0.2);

      // Higher harmonic for mobile speaker presence
      const hi = ac.createOscillator();
      const hiG = ac.createGain();
      hi.type = "sine";
      hi.frequency.setValueAtTime(300, time);
      hi.frequency.exponentialRampToValueAtTime(80, time + 0.08);
      hiG.gain.setValueAtTime(gain * 0.4, time);
      hiG.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      hi.connect(hiG).connect(ac.destination);
      hi.start(time);
      hi.stop(time + 0.15);
    }

    function playBeat() {
      if (!ctx || ctx.state === "closed") return;
      const t = ctx.currentTime;
      thump(ctx, t, 0.35);        // S1 — lub
      thump(ctx, t + 0.22, 0.2);  // S2 — dub
    }

    function start() {
      abort.abort();
      // Create AudioContext INSIDE the gesture handler — Safari requires this
      const AC = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      playBeat();
      timer = setInterval(playBeat, 1200);
    }

    const opts = { signal: abort.signal };
    document.addEventListener("click", start, opts);
    document.addEventListener("touchstart", start, opts);

    return () => {
      clearInterval(timer);
      abort.abort();
      ctx?.close();
    };
  }, []);
}

// Recessed pocket carved INTO the matte panel. Dark-at-top gradient + a deep
// inset top shadow put the upper inner wall in shadow and light the lower wall,
// so it reads as a hole sunk into the surface (concave) — not a raised bump.
// No floating drop shadow; only a faint outer rim defines the lip.
const pocketStyle = {
  background: "linear-gradient(180deg, #08070a 0%, #201d22 100%)",
  boxShadow:
    "inset 0 6px 11px rgba(0,0,0,0.92), inset 0 2px 4px rgba(0,0,0,0.9), inset 0 -2px 4px rgba(255,255,255,0.06), 0 1px 1px rgba(255,255,255,0.05)",
} as const;

// Raised disc that sits proud inside the pocket — holds the social icons.
const raisedDiscStyle = {
  background: "linear-gradient(160deg, #221f23 0%, #0e0d0f 100%)",
  boxShadow:
    "inset 0 2px 2px rgba(255,255,255,0.14), inset 0 -3px 6px rgba(0,0,0,0.8), 0 3px 7px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.5)",
} as const;

// Glossy white pill that sits raised inside the pocket.
const signUpButtonStyle = {
  background: "linear-gradient(180deg, #ffffff 0%, #e3e3e8 100%)",
  boxShadow:
    "inset 0 2px 0 rgba(255,255,255,1), inset 0 -3px 6px rgba(0,0,0,0.18), 0 3px 7px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.5)",
} as const;

// White icons get a subtle emboss so they pop off the well like the logo capsules.
const iconSvgClass = "drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]";

export default function Hero() {
  const [open, setOpen] = useState(false);
  const [signUpCount, setSignUpCount] = useState(0);
  useHeartbeatSound();

  return (
    <section className="relative w-full flex-1 overflow-hidden bg-[#100e10]">
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

      {/* Single centered column filling the hero. The hero flexes to whatever
          height is left after the footer, so everything fits one viewport. */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 px-4 sm:gap-8">
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

        <div className="rounded-[1.6rem] p-2.5" style={pocketStyle}>
          <button
            onClick={() => setOpen(true)}
            className="rounded-[1.1rem] px-7 py-2.5 text-sm font-semibold text-black transition-transform duration-150 will-change-transform hover:-translate-y-px active:translate-y-px sm:px-9 sm:py-3 sm:text-base"
            style={signUpButtonStyle}
          >
            Sign Up
          </button>
        </div>

        <div className="flex items-center gap-5">
          <a
            href="https://www.instagram.com/attosound_?igsh=Mm1pNmhkOTlxNHd4&utm_source=qr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 w-14 items-center justify-center rounded-full transition-transform sm:h-16 sm:w-16 duration-150 will-change-transform hover:-translate-y-0.5 active:translate-y-px"
            style={pocketStyle}
            aria-label="Instagram"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full text-white sm:h-12 sm:w-12" style={raisedDiscStyle}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={iconSvgClass}
              >
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </span>
          </a>

          <a
            href="https://www.tiktok.com/@attosound?_r=1&_t=ZP-94JSiDKOf6c"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 w-14 items-center justify-center rounded-full transition-transform sm:h-16 sm:w-16 duration-150 will-change-transform hover:-translate-y-0.5 active:translate-y-px"
            style={pocketStyle}
            aria-label="TikTok"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full text-white sm:h-12 sm:w-12" style={raisedDiscStyle}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={iconSvgClass}
              >
                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
              </svg>
            </span>
          </a>

          <a
            href="https://www.youtube.com/@ATTOSOUND"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 w-14 items-center justify-center rounded-full transition-transform sm:h-16 sm:w-16 duration-150 will-change-transform hover:-translate-y-0.5 active:translate-y-px"
            style={pocketStyle}
            aria-label="YouTube"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full text-white sm:h-12 sm:w-12" style={raisedDiscStyle}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
                className={iconSvgClass}
              >
                <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17ZM10 15l5-3-5-3z" />
              </svg>
            </span>
          </a>
        </div>

        <WaitlistCounter increment={signUpCount} />
      </div>

      <SignUpModal
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => setSignUpCount((c) => c + 1)}
      />
    </section>
  );
}
