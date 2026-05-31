"use client";

import { useState } from "react";
import { Waves, X, ExternalLink } from "lucide-react";

const SOCIALS = [
  { label: "GitHub", href: "https://github.com/timix648" },
  { label: "X / Twitter", href: "https://x.com/" },
  { label: "Discord", href: "https://discord.com/" },
];

export default function SocialsButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-19 right-19 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div className="flex flex-col items-end gap-2">
          {SOCIALS.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full border border-white/25 bg-background/70 px-3 py-2 shadow-lg hover:bg-background">
              <span className="text-sm font-medium">{s.label}</span>
              <ExternalLink className="w-4 h-4 text-primary" />
            </a>
          ))}
        </div>
      ) : null}
      <button onClick={() => setOpen((v) => !v)} aria-label="Toggle socials" className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-110">
        {open ? <X className="w-7 h-7" /> : <Waves className="w-7 h-7" />}
      </button>
    </div>
  );
}