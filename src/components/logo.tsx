import "./logo.css";

// Fader positions from atto-app Logo.tsx (9 faders, circle R=116, viewBox 230x230).
const FADERS = [
  { x: -112.9, top: -78.5, bot: 18.5 },
  { x: -85.1, top: -26.5, bot: 3.5 },
  { x: -58.1, top: -61.4, bot: 28.5 },
  { x: -31, top: -65.3, bot: 59.3 },
  { x: 0, top: -45.5, bot: 88.5 },
  { x: 31, top: -67.8, bot: 50 },
  { x: 58.1, top: -64.8, bot: 28.5 },
  { x: 85.1, top: -26.5, bot: 3.5 },
  { x: 112.9, top: -78.5, bot: 18.5 },
];

const CIRCLE_R = 126;
const CAPSULE_W = 15.5;
const STEM_W = 1.8;

export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-132 -132 264 264"
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
