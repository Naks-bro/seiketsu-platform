/**
 * Hand-drawn style illustrations in the brand palette, drawn as SVG so they
 * stay crisp and weigh almost nothing. Decorative: always aria-hidden.
 */
type P = { className?: string; style?: React.CSSProperties };
const ink = "#2a181e";
const s = { stroke: ink, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function Avocado({ className, style }: P) {
  return (
    <svg viewBox="0 0 120 150" className={className} style={style} aria-hidden>
      <path d="M60 8c22 0 32 30 40 58s4 76-40 76S12 94 20 66 38 8 60 8Z" fill="#9e9935" {...s} />
      <path d="M60 24c15 0 22 22 28 44s3 58-28 58-34-36-28-58 13-44 28-44Z" fill="#fce9ab" stroke="none" />
      <circle cx="60" cy="92" r="20" fill="#a3520f" {...s} />
      <path d="M52 84c4-4 10-5 14-3" fill="none" stroke="#fffcf5" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Tomato({ className, style }: P) {
  return (
    <svg viewBox="0 0 120 120" className={className} style={style} aria-hidden>
      <path d="M60 24c30 0 48 20 48 44s-20 44-48 44-48-18-48-44 18-44 48-44Z" fill="#e04d75" {...s} />
      <path d="M34 50c4-10 14-16 24-17" fill="none" stroke="#fffcf5" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 30 48 16l12 6 6-14 4 15 14-5-10 12" fill="#9e9935" {...s} />
    </svg>
  );
}

export function Leaf({ className, style }: P) {
  return (
    <svg viewBox="0 0 120 120" className={className} style={style} aria-hidden>
      <path d="M14 106C14 50 50 14 108 12c0 58-36 94-94 94Z" fill="#9e9935" {...s} />
      <path d="M14 106 80 40M40 80l-2-22M56 64l-2-20M40 80l22 2M56 64l22 1" fill="none" {...s} strokeWidth={2} />
    </svg>
  );
}

export function Lemon({ className, style }: P) {
  return (
    <svg viewBox="0 0 120 120" className={className} style={style} aria-hidden>
      <circle cx="60" cy="60" r="46" fill="#fce9ab" {...s} />
      <circle cx="60" cy="60" r="36" fill="#f68a31" opacity=".35" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={a} d="M60 60 60 26" transform={`rotate(${a} 60 60)`} {...s} strokeWidth={2} />
      ))}
      <circle cx="60" cy="60" r="5" fill="#fffcf5" {...s} strokeWidth={2} />
    </svg>
  );
}

export function Broccoli({ className, style }: P) {
  return (
    <svg viewBox="0 0 120 140" className={className} style={style} aria-hidden>
      <path d="M48 132 52 84h16l4 48Z" fill="#c9c46a" {...s} />
      <path d="M30 88a18 18 0 0 1-4-34 22 22 0 0 1 36-18 20 20 0 0 1 34 12 18 18 0 0 1-2 40Z" fill="#67651f" {...s} />
      <circle cx="44" cy="62" r="4" fill="#9e9935" />
      <circle cx="70" cy="50" r="5" fill="#9e9935" />
      <circle cx="82" cy="72" r="4" fill="#9e9935" />
    </svg>
  );
}

export function Bowl({ className, style }: P) {
  return (
    <svg viewBox="0 0 220 160" className={className} style={style} aria-hidden>
      <path d="M30 64c20-30 50-22 62-30 16-10 40-6 50 6 14-6 36 0 46 24Z" fill="#9e9935" {...s} />
      <circle cx="74" cy="52" r="12" fill="#e04d75" {...s} />
      <circle cx="140" cy="48" r="10" fill="#e04d75" {...s} />
      <path d="M100 40c10-6 22-4 28 4-8 6-20 6-28-4Z" fill="#fce9ab" {...s} />
      <path d="M156 56c8-10 20-10 26-2-6 8-18 8-26 2Z" fill="#f68a31" {...s} />
      <path d="M14 64h192c0 44-42 78-96 78S14 108 14 64Z" fill="#a51c47" {...s} />
      <path d="M40 84c12 22 36 36 70 36" fill="none" stroke="#fffcf5" strokeWidth="4" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

export function Sparkle({ className, style }: P) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} aria-hidden>
      <path d="M20 2c2 10 8 16 18 18-10 2-16 8-18 18-2-10-8-16-18-18C12 18 18 12 20 2Z" fill="currentColor" />
    </svg>
  );
}

export function Farm({ className }: P) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <path d="M14 108h132" {...s} />
      <path d="M24 108V52l56-32 56 32v56" fill="#fffcf5" {...s} />
      <path d="M24 52l56-32 56 32" fill="none" {...s} strokeWidth={3} />
      {[44, 72, 100].map((y, i) => (
        <g key={y}>
          <path d={`M36 ${y}h88`} stroke="#a51c47" strokeWidth="3" strokeLinecap="round" />
          {[48, 68, 88, 108].map((x) => (
            <path key={x} d={`M${x + (i % 2) * 6} ${y}c-6-8-2-14 4-16 2 8-1 13-4 16Z`} fill="#9e9935" {...s} strokeWidth={1.6} />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function Crate({ className }: P) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <circle cx="52" cy="46" r="16" fill="#e04d75" {...s} />
      <circle cx="84" cy="40" r="18" fill="#f68a31" {...s} />
      <path d="M100 52c4-22 26-26 34-18-6 14-20 22-34 18Z" fill="#9e9935" {...s} />
      <path d="M28 54h104l-8 54H36Z" fill="#fce9ab" {...s} />
      <path d="M32 76h96M34 94h92" {...s} strokeWidth={2} />
    </svg>
  );
}

export function Scooter({ className }: P) {
  return (
    <svg viewBox="0 0 240 200" className={className} aria-hidden>
      <path d="M20 176h200" {...s} strokeDasharray="2 10" />
      <circle cx="60" cy="152" r="22" fill="#fffcf5" {...s} />
      <circle cx="176" cy="152" r="22" fill="#fffcf5" {...s} />
      <path d="M60 152h40l20-40h36l20 40" fill="none" {...s} strokeWidth={3} />
      <path d="M84 112h58c14 0 22 10 22 22v18H90c-14 0-20-10-20-20s4-20 14-20Z" fill="#a51c47" {...s} />
      <path d="M150 112l14-50h18" fill="none" {...s} strokeWidth={3} />
      <rect x="64" y="64" width="54" height="44" rx="8" fill="#fce9ab" {...s} />
      <path d="M78 86h26" {...s} />
      <path d="M190 30c-14 0-24 10-24 24 0 18 24 40 24 40s24-22 24-40c0-14-10-24-24-24Z" fill="#e04d75" {...s} />
      <circle cx="190" cy="54" r="8" fill="#fffcf5" {...s} />
    </svg>
  );
}

/** A slowly turning round badge with text on a circle. */
export function SpinBadge({ text, className }: { text: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <path id="badge-circle" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0" />
      </defs>
      <circle cx="60" cy="60" r="58" fill="#fce9ab" />
      <g className="origin-center animate-[spin_24s_linear_infinite]">
        <text fontSize="12.5" fontWeight="700" letterSpacing="3.2" fill="#a51c47">
          <textPath href="#badge-circle">{text}</textPath>
        </text>
      </g>
      <path d="M60 40c2 10 8 16 18 18-10 2-16 8-18 18-2-10-8-16-18-18 10-2 16-8 18-18Z" fill="#a51c47" />
    </svg>
  );
}
