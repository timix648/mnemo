"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEnokiFlow } from "@mysten/enoki/react";
import { Brain, Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const flow = useEnokiFlow();

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);

    // Enoki puts the auth response in the URL hash or query params.
    if (hash || params.get("id_token") || params.get("code")) {
      flow.handleAuthCallback()
        .then(async (result) => {
          console.log("Auth callback success:", result);
          sessionStorage.setItem("mnemo_authed", "true");

          // Returning user (has a namespace already) → straight to /search.
          // New user (no namespace yet) → /onboard.
          // The backend auto-provisions a user + default namespace on first
          // /me call, so a returning user reliably has default_namespace_id.
          try {
            const addr = (result as { address?: string })?.address;
            if (addr) {
              const res = await fetch("http://127.0.0.1:8001/me", {
                headers: { "X-Sui-Address": addr },
              });
              if (res.ok) {
                const me = await res.json();
                if (me.default_namespace_id) {
                  router.push("/search");
                  return;
                }
              }
            }
          } catch {
            // Network error or backend down — fall through to onboarding.
          }
          router.push("/onboard");
        })
        .catch((err) => {
          console.error("Auth callback failed:", err);
          router.push("/");
        });
    } else {
      // No auth params — redirect to home.
      router.push("/");
    }
  }, [flow, router]);

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