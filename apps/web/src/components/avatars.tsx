"use client";

import type { ReactNode } from "react";

/**
 * Preset, original ocean-creature avatars (no third-party IP).
 * Each is a self-contained SVG on a tinted circular background, so it always
 * renders as a clean round avatar at any size via the `className` (w-/h-).
 *
 * Usage:
 *   <CreatureAvatar id="clownfish" className="h-8 w-8" />
 *   AVATARS.map(a => ...)  // for the picker grid
 */

export const DEFAULT_AVATAR_ID = "clownfish";

interface AvatarDef {
  id: string;
  label: string;
  bg: string;
  body: ReactNode; // drawn on a 64x64 canvas, over the bg circle
}

const dark = "#16313f";

export const AVATARS: AvatarDef[] = [
  {
    id: "clownfish",
    label: "Clownfish",
    bg: "#bfe9e4",
    body: (
      <>
        <path d="M16 34 L5 26 L7 34 L5 42 Z" fill="#ff7a33" />
        <ellipse cx="32" cy="34" rx="16" ry="11" fill="#ff7a33" />
        <rect x="24" y="24" width="4.5" height="20" rx="2" fill="#fff" />
        <rect x="34" y="25" width="4" height="18" rx="2" fill="#fff" />
        <circle cx="41" cy="31" r="3.2" fill="#fff" />
        <circle cx="42" cy="31" r="1.6" fill={dark} />
      </>
    ),
  },
  {
    id: "pufferfish",
    label: "Pufferfish",
    bg: "#cfe3ff",
    body: (
      <>
        <g stroke="#f0a92e" strokeWidth="3" strokeLinecap="round">
          <line x1="32" y1="18" x2="32" y2="13" />
          <line x1="46" y1="34" x2="51" y2="34" />
          <line x1="18" y1="34" x2="13" y2="34" />
          <line x1="32" y1="50" x2="32" y2="55" />
          <line x1="42" y1="24" x2="46" y2="20" />
          <line x1="22" y1="24" x2="18" y2="20" />
          <line x1="42" y1="44" x2="46" y2="48" />
          <line x1="22" y1="44" x2="18" y2="48" />
        </g>
        <circle cx="32" cy="34" r="13" fill="#ffd14d" />
        <circle cx="27" cy="32" r="2.6" fill="#fff" />
        <circle cx="37" cy="32" r="2.6" fill="#fff" />
        <circle cx="27.5" cy="32" r="1.3" fill={dark} />
        <circle cx="37.5" cy="32" r="1.3" fill={dark} />
        <path d="M28 39 q4 3 8 0" stroke={dark} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "turtle",
    label: "Turtle",
    bg: "#cdeede",
    body: (
      <>
        <ellipse cx="18" cy="26" rx="5" ry="3" fill="#67c27d" transform="rotate(-30 18 26)" />
        <ellipse cx="46" cy="26" rx="5" ry="3" fill="#67c27d" transform="rotate(30 46 26)" />
        <ellipse cx="20" cy="44" rx="5" ry="3" fill="#67c27d" transform="rotate(30 20 44)" />
        <ellipse cx="44" cy="44" rx="5" ry="3" fill="#67c27d" transform="rotate(-30 44 44)" />
        <circle cx="32" cy="18" r="5.5" fill="#67c27d" />
        <circle cx="30" cy="17" r="1.2" fill={dark} />
        <circle cx="34" cy="17" r="1.2" fill={dark} />
        <ellipse cx="32" cy="35" rx="15" ry="12" fill="#3f9d57" />
        <circle cx="32" cy="35" r="4" fill="#2f7a43" />
        <circle cx="24" cy="32" r="2.4" fill="#2f7a43" />
        <circle cx="40" cy="32" r="2.4" fill="#2f7a43" />
        <circle cx="26" cy="41" r="2.4" fill="#2f7a43" />
        <circle cx="38" cy="41" r="2.4" fill="#2f7a43" />
      </>
    ),
  },
  {
    id: "octopus",
    label: "Octopus",
    bg: "#e7d4f5",
    body: (
      <>
        <g stroke="#b06bd6" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M20 36 q-3 9 1 13" />
          <path d="M26 38 q-1 9 1 14" />
          <path d="M32 38 q0 9 0 14" />
          <path d="M38 38 q1 9 -1 14" />
          <path d="M44 36 q3 9 -1 13" />
        </g>
        <ellipse cx="32" cy="27" rx="13" ry="12" fill="#b06bd6" />
        <circle cx="27" cy="25" r="3" fill="#fff" />
        <circle cx="37" cy="25" r="3" fill="#fff" />
        <circle cx="27.6" cy="25" r="1.5" fill={dark} />
        <circle cx="37.6" cy="25" r="1.5" fill={dark} />
        <path d="M28 32 q4 3 8 0" stroke={dark} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "whale",
    label: "Whale",
    bg: "#d6ecfa",
    body: (
      <>
        <g fill="#7fb3e8">
          <circle cx="20" cy="15" r="1.6" />
          <circle cx="23" cy="12" r="1.3" />
        </g>
        <path d="M44 34 L55 27 L53 41 Z" fill="#5aa9e0" />
        <ellipse cx="30" cy="37" rx="17" ry="11" fill="#5aa9e0" />
        <ellipse cx="29" cy="41" rx="13" ry="5.5" fill="#d6ecfa" />
        <circle cx="21" cy="34" r="2" fill={dark} />
        <path d="M15 39 q6 4 12 0" stroke={dark} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "crab",
    label: "Crab",
    bg: "#ffe2c2",
    body: (
      <>
        <g stroke="#e8553f" strokeWidth="3" strokeLinecap="round">
          <line x1="22" y1="42" x2="14" y2="46" />
          <line x1="22" y1="38" x2="13" y2="40" />
          <line x1="42" y1="42" x2="50" y2="46" />
          <line x1="42" y1="38" x2="51" y2="40" />
        </g>
        <circle cx="14" cy="30" r="5" fill="#e8553f" />
        <circle cx="50" cy="30" r="5" fill="#e8553f" />
        <ellipse cx="32" cy="37" rx="14" ry="9" fill="#e8553f" />
        <line x1="27" y1="29" x2="26" y2="23" stroke="#e8553f" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="37" y1="29" x2="38" y2="23" stroke="#e8553f" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="26" cy="22" r="2.6" fill="#fff" />
        <circle cx="38" cy="22" r="2.6" fill="#fff" />
        <circle cx="26" cy="22" r="1.2" fill={dark} />
        <circle cx="38" cy="22" r="1.2" fill={dark} />
        <path d="M27 39 q5 3 10 0" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "jellyfish",
    label: "Jellyfish",
    bg: "#e0d7f0",
    body: (
      <>
        <g stroke="#f8b4cd" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M22 33 q-2 7 1 13" />
          <path d="M28 34 q-1 8 1 14" />
          <path d="M32 34 q0 8 0 14" />
          <path d="M36 34 q1 8 -1 14" />
          <path d="M42 33 q2 7 -1 13" />
        </g>
        <path d="M18 33 A14 12 0 0 1 46 33 Z" fill="#f48fb1" />
        <circle cx="28" cy="27" r="1.6" fill={dark} />
        <circle cx="36" cy="27" r="1.6" fill={dark} />
        <path d="M29 30 q3 2 6 0" stroke={dark} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "starfish",
    label: "Starfish",
    bg: "#bfe9e4",
    body: (
      <>
        <path
          d="M32 17 L36.1 27.3 L47.2 28.1 L38.7 35.2 L41.4 45.9 L32 40 L22.6 45.9 L25.3 35.2 L16.8 28.1 L27.9 27.3 Z"
          fill="#ff9a5c"
        />
        <circle cx="28.5" cy="31" r="1.5" fill={dark} />
        <circle cx="35.5" cy="31" r="1.5" fill={dark} />
        <path d="M29 34 q3 2 6 0" stroke={dark} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
];

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

export function CreatureAvatar({
  id,
  className = "h-8 w-8",
}: {
  id?: string | null;
  className?: string;
}) {
  const a = BY_ID.get(id ?? DEFAULT_AVATAR_ID) ?? BY_ID.get(DEFAULT_AVATAR_ID)!;
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 ${className}`} role="img" aria-label={a.label}>
      <circle cx="32" cy="32" r="32" fill={a.bg} />
      {a.body}
    </svg>
  );
}
