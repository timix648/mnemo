"use client";

/**
 * Preset ocean-creature avatars, served as images from /public/avatars.
 * Drop the PNGs into  apps/web/public/avatars/<id>.png  and they resolve at
 * the root path "/avatars/<id>.png". Rendered as a circular, cover-cropped img.
 *
 *   <CreatureAvatar id="clownfish" className="h-8 w-8" />
 *   AVATARS.map(a => ...)   // for the picker grid
 */

export const DEFAULT_AVATAR_ID = "clownfish";

export interface AvatarDef {
  id: string;
  label: string;
}

export const AVATARS: AvatarDef[] = [
  { id: "clownfish", label: "Clownfish" },
  { id: "seal", label: "Seal" },
  { id: "sealpup", label: "Seal Pup" },
  { id: "walrus", label: "Walrus" },
  { id: "turtle", label: "Turtle" },
  { id: "octopus", label: "Octopus" },
  { id: "whale", label: "Whale" },
  { id: "crab", label: "Crab" },
  { id: "jellyfish", label: "Jellyfish" },
  { id: "starfish", label: "Starfish" },
];

const VALID = new Set(AVATARS.map((a) => a.id));

export function CreatureAvatar({
  id,
  className = "h-8 w-8",
}: {
  id?: string | null;
  className?: string;
}) {
  const safe = id && VALID.has(id) ? id : DEFAULT_AVATAR_ID;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={`/avatars/${safe}.png`}
      alt=""
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}
