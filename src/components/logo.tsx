import "./logo.css";

// Fader positions from atto-app Logo.tsx (9 faders, circle R=116, viewBox 230x230).
const FADERS = [
  { x: -102.6, top: -80, bot: 20 },
  { x: -77.4, top: -28, bot: 5 },
  { x: -52.8, top: -62.9, bot: 30 },
  { x: -28.2, top: -63.8, bot: 63.8 },
  { x: 0, top: -54.5, bot: 83.1 },
  { x: 28.2, top: -66.3, bot: 54.5 },
  { x: 52.8, top: -66.3, bot: 30 },
  { x: 77.4, top: -28, bot: 5 },
  { x: 102.6, top: -80, bot: 20 },
];

const CIRCLE_R = 116;
const CAPSULE_W = 12.8;
const STEM_W = 1.2;

export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-115 -115 230 230"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="logo-circle">
          <circle cx="0" cy="0" r={CIRCLE_R} />
        </clipPath>
      </defs>
      <g clipPath="url(#logo-circle)">
        {FADERS.map((f, i) => (
          <line
            key={`s${i}`}
            x1={f.x}
            y1={-CIRCLE_R}
            x2={f.x}
            y2={CIRCLE_R}
            stroke="white"
            strokeWidth={STEM_W}
            opacity={0.55}
          />
        ))}
        {FADERS.map((f, i) => (
          <line
            key={`c${i}`}
            x1={f.x}
            y1={f.top}
            x2={f.x}
            y2={f.bot}
            stroke="white"
            strokeWidth={CAPSULE_W}
            strokeLinecap="round"
            className={i > 0 && i < FADERS.length - 1 ? "logo-capsule" : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
