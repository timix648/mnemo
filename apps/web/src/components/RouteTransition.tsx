"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MnemoSchoolLoader } from "@/components/Clownfish";

/**
 * Brief full-screen clownfish transition shown on every route change.
 * Purely visual — sits above content, fades out after a beat. No effect on
 * data, navigation, or page logic.
 */
export default function RouteTransition() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    // Skip the very first mount so we don't flash on initial load.
    if (first.current) {
      first.current = false;
      return;
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 750);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-md animate-in fade-in duration-200">
      <MnemoSchoolLoader label="Swimming over…" />
    </div>
  );
}