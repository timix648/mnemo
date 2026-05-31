"use client";

/**
 * Mnemo's clownfish mascot (original art — no third-party IP). Uses:
 *   <ClownfishMascot />          – big swimming fish for the landing hero
 *   <MnemoLoader label="..." />  – single swimming fish + bubbles
 *   <MnemoSchoolLoader />        – a ring of fish (nose-to-tail) rotating as one wheel
 *   <MascotTip text="..." />     – small fish with a speech bubble for onboarding
 *
 * All animation is CSS (scoped class names) and respects prefers-reduced-motion.
 * No Math.random / Date — safe for SSR (no hydration mismatch).
 */

export function ClownfishSVG({ className = "h-16 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 130 92" className={className} xmlns="http://www.w3.org/2000/svg"
         role="img" aria-label="Mnemo clownfish">
      <path d="M34 46 L6 25 Q13 46 6 67 Z" fill="#ee7a26" />
      <path d="M46 26 Q66 12 90 28 Q72 25 54 32 Z" fill="#ee7a26" />
      <path d="M52 64 Q66 79 84 64 Q70 68 56 60 Z" fill="#ee7a26" />
      <ellipse cx="66" cy="46" rx="38" ry="24" fill="#ff8a3d" stroke="#e96f1c" strokeWidth="1" />
      <path d="M74 51 Q82 63 92 54 Q84 52 78 47 Z" fill="#ff9d5a" />
      <path d="M38 29 Q44 46 38 63 L47 63 Q53 46 47 29 Z" fill="#ffffff" stroke="#22150e" strokeWidth="2" />
      <path d="M58 26 Q64 46 58 66 L67 66 Q73 46 67 26 Z" fill="#ffffff" stroke="#22150e" strokeWidth="2" />
      <path d="M83 29 Q89 46 83 63 L92 63 Q98 46 92 29 Z" fill="#ffffff" stroke="#22150e" strokeWidth="2" />
      <circle cx="97" cy="40" r="6.5" fill="#ffffff" stroke="#22150e" strokeWidth="1.5" />
      <circle cx="98" cy="40" r="3.2" fill="#22150e" />
      <circle cx="96" cy="38.5" r="1.2" fill="#fff" />
      <path d="M106 47 q3 2.5 -0.5 4.5" fill="none" stroke="#22150e" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MascotStyles() {
  return (
    <style>{`
      @keyframes mnemo-swim { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-8%) rotate(2deg)} }
      @keyframes mnemo-bubrise { 0%{transform:translateY(0) scale(.6);opacity:0} 20%{opacity:.6} 100%{transform:translateY(-200%) scale(1);opacity:0} }
      .mnemo-swim{ animation: mnemo-swim 2.6s ease-in-out infinite; transform-origin:center; will-change:transform; }
      .mnemo-bub{ position:absolute; bottom:6%; border-radius:9999px;
                  background:color-mix(in oklab, var(--primary) 35%, white);
                  animation: mnemo-bubrise 2.4s ease-in infinite; }
      @media (prefers-reduced-motion: reduce){ .mnemo-swim{animation:none} .mnemo-bub{display:none} }
    `}</style>
  );
}

export function ClownfishMascot({ className = "h-40 w-auto", swim = true }:
  { className?: string; swim?: boolean }) {
  return (
    <span className={`inline-block ${swim ? "mnemo-swim" : ""}`}>
      <MascotStyles />
      <ClownfishSVG className={className} />
    </span>
  );
}

export function MnemoLoader({ label, size = 72 }: { label?: string; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <MascotStyles />
      <div className="relative" style={{ width: size * 1.4, height: size }}>
        <span className="mnemo-bub" style={{ left: "28%", width: 6, height: 6, animationDelay: "0s" }} />
        <span className="mnemo-bub" style={{ left: "50%", width: 9, height: 9, animationDelay: ".5s" }} />
        <span className="mnemo-bub" style={{ left: "68%", width: 5, height: 5, animationDelay: "1s" }} />
        <span className="mnemo-swim absolute inset-0 flex items-center justify-center">
          <ClownfishSVG className="h-full w-auto" />
        </span>
      </div>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}

/**
 * A ring of clownfish, evenly spaced nose-to-tail, rotating as one rigid wheel —
 * the page-transition / loading spinner. Each fish's nose points toward the
 * base (tail) of the next, so they "chase" cleanly around the circle.
 */
export function MnemoSchoolLoader({ label, size = 132, count = 6 }:
  { label?: string; size?: number; count?: number }) {
  const radius = size * 0.34;
  const angles = Array.from({ length: count }, (_, i) => (360 / count) * i);
  return (
    <div className="flex flex-col items-center gap-4">
      <style>{`
        @keyframes mnemo-wheel { to { transform: rotate(360deg); } }
        .mnemo-wheel { animation: mnemo-wheel 4s linear infinite; }
        @media (prefers-reduced-motion: reduce){ .mnemo-wheel { animation: none; } }
      `}</style>
      <div className="mnemo-wheel relative" style={{ width: size, height: size }}>
        {angles.map((a, i) => (
          // Place on the rim at angle `a`, then rotate 90° so the nose points
          // along the circle (toward the next fish's tail). The wheel spins as
          // a single rigid unit, keeping them evenly spaced.
          <span
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `translate(-50%, -50%) rotate(${a}deg) translateX(${radius}px) rotate(90deg)` }}
          >
            <ClownfishSVG className="h-7 w-auto drop-shadow-sm" />
          </span>
        ))}
      </div>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}

export function MascotTip({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <ClownfishMascot className="h-12 w-auto shrink-0" />
      <div className="rounded-2xl rounded-bl-sm border bg-card px-3 py-2 text-sm text-card-foreground shadow-sm">
        {text}
      </div>
    </div>
  );
}

export default ClownfishMascot;