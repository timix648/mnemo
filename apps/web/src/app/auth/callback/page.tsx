"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEnokiFlow, useZkLogin } from "@mysten/enoki/react";
import { CreatureAvatar } from "@/components/avatars";
import { MnemoSchoolLoader } from "@/components/Clownfish";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8001";

export default function AuthCallbackPage() {
  const router = useRouter();
  const flow = useEnokiFlow();
  // The reliable source of the signed-in address. handleAuthCallback() does
  // NOT return it — it returns the redirect state — so we read it from the
  // zkLogin hook, which populates once the session is established.
  const { address } = useZkLogin();

  const [handled, setHandled] = useState(false);   // OAuth exchange done
  const decidedRef = useRef(false);                 // routing decision made once
  const ranRef = useRef(false);                     // handleAuthCallback once
  const [welcome, setWelcome] = useState<{ name: string | null; avatarId: string | null } | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Step 1 — complete the OAuth callback exactly once.
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    if (!(hash || params.get("id_token") || params.get("code"))) {
      router.push("/");
      return;
    }

    flow.handleAuthCallback()
      .then(() => {
        sessionStorage.setItem("mnemo_authed", "true");
        setHandled(true);
      })
      .catch((err) => {
        console.error("Auth callback failed:", err);
        router.push("/");
      });
  }, [flow, router]);

  // Step 2 — once the exchange is done AND the address is available, decide
  // where to send the user. Runs only once (decidedRef).
  useEffect(() => {
    if (!handled || !address || decidedRef.current) return;
    decidedRef.current = true;

    (async () => {
      const headers = { "X-Sui-Address": address };
      try {
        const [meRes, keysRes] = await Promise.all([
          fetch(`${API_BASE}/me`, { headers }),
          fetch(`${API_BASE}/keys`, { headers }),
        ]);
        const me = meRes.ok ? await meRes.json() : null;
        const keys = keysRes.ok ? await keysRes.json() : [];

        const returning =
          (Array.isArray(keys) && keys.length > 0) ||
          Boolean(me?.display_name) ||
          Boolean(me?.avatar_id);

        if (returning) {
          setWelcome({ name: me?.display_name ?? null, avatarId: me?.avatar_id ?? null });
          setTimeout(() => setLeaving(true), 1400);
          setTimeout(() => router.push("/"), 1900);
          return;
        }
      } catch {
        // Backend unreachable — treat as new and let them onboard.
      }
      router.push("/onboard");
    })();
  }, [handled, address, router]);

  // Safety net: if the address never arrives after the exchange, don't hang.
  useEffect(() => {
    if (!handled) return;
    const t = setTimeout(() => {
      if (!decidedRef.current) {
        decidedRef.current = true;
        router.push("/onboard");
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [handled, router]);

  if (welcome) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div
          className={`flex flex-col items-center gap-4 text-center duration-500 ${
            leaving ? "animate-out fade-out zoom-out-95" : "animate-in fade-in zoom-in-95"
          }`}
        >
          <CreatureAvatar id={welcome.avatarId} className="h-24 w-24 ring-4 ring-primary/20" />
          <h1 className="text-2xl font-bold">
            Welcome back{welcome.name ? `, ${welcome.name}` : ""}!
          </h1>
          <p className="text-muted-foreground text-sm">Taking you home…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-5 text-center">
        <h1 className="text-xl font-bold">Securing your identity…</h1>
        <MnemoSchoolLoader size={120} label="Completing Google sign-in via Enoki zkLogin…" />
      </div>
    </div>
  );
}