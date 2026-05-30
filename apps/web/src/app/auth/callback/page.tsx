"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEnokiFlow } from "@mysten/enoki/react";
import { Brain, Loader2 } from "lucide-react";
import { CreatureAvatar } from "@/components/avatars";

const API_BASE = "http://127.0.0.1:8001";

export default function AuthCallbackPage() {
  const router = useRouter();
  const flow = useEnokiFlow();
  // When set, render the "Welcome back" screen briefly before routing home.
  const [welcome, setWelcome] = useState<{ name: string | null; avatarId: string | null } | null>(null);
  const [leaving, setLeaving] = useState(false); // drives the fade-out

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    if (!(hash || params.get("id_token") || params.get("code"))) {
      router.push("/");
      return;
    }

    flow.handleAuthCallback()
      .then(async (result) => {
        sessionStorage.setItem("mnemo_authed", "true");
        const addr = (result as { address?: string })?.address;
        if (!addr) {
          router.push("/onboard");
          return;
        }

        const headers = { "X-Sui-Address": addr };
        try {
          const [meRes, keysRes] = await Promise.all([
            fetch(`${API_BASE}/me`, { headers }),
            fetch(`${API_BASE}/keys`, { headers }),
          ]);
          const me = meRes.ok ? await meRes.json() : null;
          const keys = keysRes.ok ? await keysRes.json() : [];

          // Returning = has completed any of: a stored key, a chosen name, or
          // a chosen avatar. (Previously only keys counted, so a user with a
          // profile but no key got bounced back through onboarding.)
          const returning =
            (Array.isArray(keys) && keys.length > 0) ||
            Boolean(me?.display_name) ||
            Boolean(me?.avatar_id);

          if (returning) {
            setWelcome({ name: me?.display_name ?? null, avatarId: me?.avatar_id ?? null });
            // Show the greeting, fade it out, then transition to the homepage.
            setTimeout(() => setLeaving(true), 1400);
            setTimeout(() => router.push("/"), 1900);
            return;
          }
        } catch {
          // Backend unreachable — fall through to onboarding.
        }
        router.push("/onboard");
      })
      .catch((err) => {
        console.error("Auth callback failed:", err);
        router.push("/");
      });
  }, [flow, router]);

  if (welcome) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div
          className={`flex flex-col items-center gap-4 text-center duration-500 ${
            leaving
              ? "animate-out fade-out zoom-out-95"
              : "animate-in fade-in zoom-in-95"
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
      <div className="flex flex-col items-center gap-4 text-center">
        <Brain className="w-10 h-10 text-primary animate-pulse" />
        <h1 className="text-xl font-bold">Securing your identity...</h1>
        <p className="text-muted-foreground text-sm">
          Completing Google sign-in via Enoki zkLogin...
        </p>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    </div>
  );
}
