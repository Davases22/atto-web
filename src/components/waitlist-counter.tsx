"use client";

import { useEffect, useRef, useState } from "react";

const DIGIT_H = 3.5; // rem per digit cell (h-14)
const CYCLE = DIGIT_H * 10; // 25rem for one full 0-9 cycle
const SPEEDS = [18, 22, 28, 20]; // rem/s rolling speed per column
const EASE_RATE = 5; // deceleration factor

export default function WaitlistCounter({
  increment = 0,
}: {
  increment?: number;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
    if (!url) return;

    async function fetchCount() {
      try {
        const res = await fetch(url!);
        const data = await res.json();
        setCount(data.count);
      } catch {
        /* silently fail */
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const displayCount = count !== null ? count + increment : null;

  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3].map((i) => (
        <OdometerDigit
          key={i}
          target={
            displayCount !== null
              ? Number(String(displayCount).padStart(4, "0")[i])
              : null
          }
          speed={SPEEDS[i]}
        />
      ))}
    </div>
  );
}

function OdometerDigit({
  target,
  speed,
}: {
  target: number | null;
  speed: number;
}) {
  const posRef = useRef(0);
  const targetPosRef = useRef<number | null>(null);
  const prevDigitRef = useRef<number | null>(null);
  const prevTimeRef = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);

  // When target digit changes, compute a forward target position
  useEffect(() => {
    if (target === null) {
      targetPosRef.current = null;
      return;
    }
    if (prevDigitRef.current === target && targetPosRef.current !== null) return;
    prevDigitRef.current = target;

    const cur = posRef.current;
    const curMod = ((cur % CYCLE) + CYCLE) % CYCLE;
    const tgtMod = target * DIGIT_H;
    let forward = tgtMod - curMod;
    if (forward <= 0) forward += CYCLE;
    forward += CYCLE; // extra rotation for visible deceleration
    targetPosRef.current = cur + forward;
  }, [target]);

  // Animation loop
  useEffect(() => {
    let raf: number;

    function tick(time: number) {
      const dt =
        prevTimeRef.current !== null
          ? (time - prevTimeRef.current) / 1000
          : 0;
      prevTimeRef.current = time;

      const tgt = targetPosRef.current;
      if (tgt !== null) {
        // Exponential ease-out: move a fraction of remaining distance
        const remaining = tgt - posRef.current;
        if (Math.abs(remaining) < 0.01) {
          posRef.current = tgt;
        } else {
          posRef.current += remaining * Math.min(1, EASE_RATE * dt);
        }
      } else {
        // Free rolling
        posRef.current += speed * dt;
      }

      setOffset(((posRef.current % CYCLE) + CYCLE) % CYCLE);
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  return (
    <div className="relative h-14 w-10 overflow-hidden rounded-md bg-neutral-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),inset_0_-1px_2px_rgba(255,255,255,0.05)]">
      <div
        className="absolute inset-x-0 top-0"
        style={{ transform: `translateY(-${offset}rem)` }}
      >
        {/* 11 items: 0-9 + duplicate 0 for seamless loop */}
        {Array.from({ length: 11 }, (_, n) => (
          <div
            key={n}
            className="flex h-14 items-center justify-center font-mono text-2xl font-bold text-white"
          >
            {n % 10}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-neutral-900/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-neutral-900/80 to-transparent" />
    </div>
  );
}
