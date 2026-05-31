"use client";

/**
 * Ambient animated underwater scene that sits behind all content (fixed, -z-10,
 * non-interactive). "Medium" presence: visible light rays, rising bubbles, and
 * gentle seaweed, but dimmed and built on the theme's own colors so text stays
 * readable in both light and dark mode. Deterministic (no random) → SSR-safe.
 *
 * Render once in the root layout. Page wrappers must NOT use an opaque
 * `bg-background` or they'll cover this — use a transparent root instead.
 */
export function OceanBackground() {
  const bubbles = Array.from({ length: 14 }, (_, i) => ({
    left: (i * 7 + (i % 3) * 5) % 100,
    size: 6 + ((i * 13) % 16),
    delay: (i % 7) * 1.3,
    dur: 9 + (i % 6) * 2,
  }));

  return (
    <div aria-hidden className="mnemo-ocean fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <style>{`
        .mnemo-ocean{
          background:
            radial-gradient(120% 80% at 50% -10%, color-mix(in oklab, var(--accent) 45%, transparent), transparent 60%),
            linear-gradient(180deg, color-mix(in oklab, var(--secondary) 40%, var(--background)) 0%, var(--background) 55%);
        }
        .mnemo-ray{ position:absolute; top:-20%; width:16%; height:140%; transform:rotate(9deg);
          background:linear-gradient(180deg, color-mix(in oklab,#ffffff 45%,transparent), transparent 72%);
          filter:blur(10px); opacity:.3; animation:mnemo-ray-sway 11s ease-in-out infinite; }
        @keyframes mnemo-ray-sway{0%,100%{opacity:.2}50%{opacity:.42}}
        .mnemo-ob{ position:absolute; border-radius:9999px;
          background:color-mix(in oklab, var(--primary) 28%, white); opacity:0;
          animation:mnemo-ob-rise linear infinite; }
        @keyframes mnemo-ob-rise{0%{transform:translateY(0) translateX(0);opacity:0}
          10%{opacity:.5}90%{opacity:.35}100%{transform:translateY(-115vh) translateX(14px);opacity:0}}
        .mnemo-weed{ position:absolute; bottom:-8px; width:42px; height:120px; opacity:.1;
          background:color-mix(in oklab,var(--primary) 35%,var(--secondary));
          border-radius:45% 45% 0 0; transform-origin:bottom center;
          animation:mnemo-weed-sway 6s ease-in-out infinite; }
        @keyframes mnemo-weed-sway{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
        @media (prefers-reduced-motion: reduce){
          .mnemo-ray,.mnemo-ob,.mnemo-weed{animation:none}
          .mnemo-ob{display:none}
        }
      `}</style>

      <div className="mnemo-ray" style={{ left: "12%" }} />
      <div className="mnemo-ray" style={{ left: "44%", animationDelay: "3s" }} />
      <div className="mnemo-ray" style={{ left: "76%", animationDelay: "6s" }} />

      {bubbles.map((b, i) => (
        <span key={i} className="mnemo-ob" style={{
          left: `${b.left}%`, bottom: "-20px", width: b.size, height: b.size,
          animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`,
        }} />
      ))}

      <div className="mnemo-weed" style={{ left: "6%" }} />
      <div className="mnemo-weed" style={{ left: "11%", height: 90, animationDelay: "1.5s" }} />
      <div className="mnemo-weed" style={{ right: "7%", height: 104, animationDelay: "2.5s" }} />
    </div>
  );
}

export default OceanBackground;